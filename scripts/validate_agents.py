"""Validate real YAML/TOML syntax and registry-to-file integrity. No runtime services."""
import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOOLING = ROOT / 'work' / 'validation-deps'
if TOOLING.is_dir():
    sys.path.insert(0, str(TOOLING))
try:
    import yaml
except ImportError:
    raise SystemExit('Validation needs PyYAML. Run: python -m pip install --target work/validation-deps "PyYAML>=6,<7"')


class UniqueKeyLoader(yaml.SafeLoader):
    """Reject duplicate keys rather than silently accepting the last one."""


def unique_mapping(loader, node, deep=False):
    result = {}
    for key_node, value_node in node.value:
        key = loader.construct_object(key_node, deep=deep)
        if key in result:
            raise ValueError(f'Duplicate YAML field: {key}')
        result[key] = loader.construct_object(value_node, deep=deep)
    return result


UniqueKeyLoader.add_constructor(yaml.resolver.BaseResolver.DEFAULT_MAPPING_TAG, unique_mapping)


def validate_assets(root=ROOT):
    root = Path(root)
    registry = json.loads((root / 'src/agents/registry.json').read_text(encoding='utf-8'))
    errors = []
    skills = registry['skills']
    profiles = registry['customAgents']
    employees = registry['employees']
    for label, rows in [('Skills', skills), ('Custom Agents', profiles), ('Employees', employees)]:
        if len(rows) != 8 or len({row['id'] for row in rows}) != 8:
            errors.append(f'{label}: expected exactly 8 unique definitions')
    expected_skills = {s['path'] for s in skills}
    actual_skills = {p.relative_to(root).as_posix() for p in (root / '.agents/skills').glob('*/SKILL.md')}
    expected_profiles = {p['path'] for p in profiles}
    actual_profiles = {p.relative_to(root).as_posix() for p in (root / '.codex/agents').glob('*.toml')}
    for label, expected, actual in [('Skill', expected_skills, actual_skills), ('Custom Agent', expected_profiles, actual_profiles)]:
        for path in sorted(expected - actual):
            errors.append(f'Missing {label} file: {path}')
        for path in sorted(actual - expected):
            errors.append(f'Unregistered {label} file: {path}')
    for skill in skills:
        try:
            if skill['path'] != f".agents/skills/{skill['id']}/SKILL.md":
                raise ValueError('Invalid Skill path')
            text = (root / skill['path']).read_text(encoding='utf-8')
            match = re.match(r'\A---\r?\n(.*?)\r?\n---(?:\r?\n|$)', text, re.S)
            if not match:
                raise ValueError('Missing YAML frontmatter')
            metadata = yaml.load(match[1], Loader=UniqueKeyLoader)
            if not isinstance(metadata, dict) or set(metadata) != {'name', 'description'}:
                raise ValueError('Expected name and description frontmatter fields')
            if metadata['name'] != skill['id'] or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', metadata['name']) or len(metadata['name']) > 64:
                raise ValueError('Skill name does not match registry/directory')
            if not isinstance(metadata['description'], str) or not 1 <= len(metadata['description'].strip()) <= 1024:
                raise ValueError('Skill description must be a nonempty string up to 1024 characters')
            if not text[match.end():].strip():
                raise ValueError('Skill instructions are empty')
        except (OSError, ValueError, TypeError, yaml.YAMLError) as error:
            errors.append(f"{skill['id']}: {error}")
    for profile in profiles:
        try:
            if profile['path'] != f".codex/agents/{profile['id']}.toml":
                raise ValueError('Invalid Custom Agent path')
            parsed = tomllib.loads((root / profile['path']).read_text(encoding='utf-8'))
            if set(parsed) != {'name', 'description', 'developer_instructions'}:
                raise ValueError('Only the three documented required profile fields are expected')
            if any(not isinstance(value, str) or not value.strip() for value in parsed.values()):
                raise ValueError('Profile fields must be nonempty strings')
            if parsed['name'] != profile['id']:
                raise ValueError('Custom Agent name does not match registry/file')
            skill = next((s for s in skills if s['id'] == profile['skillId']), None)
            employee = next((e for e in employees if e['id'] == profile['employeeId']), None)
            if not skill or not employee or employee['customAgentId'] != profile['id'] or employee['skillId'] != skill['id']:
                raise ValueError('Broken employee-to-Skill/profile assignment')
            if skill['path'] not in parsed['developer_instructions'] or employee['role'] not in parsed['developer_instructions']:
                raise ValueError('Instructions must explicitly reference the matching primary Skill and role')
        except (OSError, ValueError, TypeError, tomllib.TOMLDecodeError) as error:
            errors.append(f"{profile['id']}: {error}")
    return errors


if __name__ == '__main__':
    problems = validate_assets()
    if problems:
        print('\n'.join(problems))
        raise SystemExit(1)
    print('Validated: 8 SKILL.md YAML manifests, 8 TOML profiles, 8 matching employee definitions.')
