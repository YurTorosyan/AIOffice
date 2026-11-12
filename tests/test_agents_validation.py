"""Negative checks against isolated copies of project configuration artifacts."""
import shutil
import tempfile
import unittest
from pathlib import Path
from scripts.validate_agents import ROOT, validate_assets


class AgentAssetValidationTests(unittest.TestCase):
    def setUp(self):
        base = (ROOT / 'work' / 'validator-fixtures').resolve()
        base.mkdir(parents=True, exist_ok=True)
        self.temp = tempfile.TemporaryDirectory(dir=base)
        self.root = Path(self.temp.name).resolve()
        # Verify the eventual recursive fixture cleanup stays within the workspace.
        self.assertTrue(self.root.is_relative_to(base) and base.is_relative_to(ROOT.resolve()))
        for directory in ['.agents/skills', '.codex/agents', 'src/agents']:
            (self.root / directory).mkdir(parents=True, exist_ok=True)
        for directory in ['.agents/skills', '.codex/agents']:
            shutil.copytree(ROOT / directory, self.root / directory, dirs_exist_ok=True)
        shutil.copy2(ROOT / 'src/agents/registry.json', self.root / 'src/agents/registry.json')
        self.addCleanup(self.temp.cleanup)

    def test_missing_skill_file(self):
        (self.root / '.agents/skills/project-architecture/SKILL.md').unlink()
        self.assertTrue(any('Missing Skill file' in e for e in validate_assets(self.root)))

    def test_missing_custom_agent_file(self):
        (self.root / '.codex/agents/qa-engineer.toml').unlink()
        self.assertTrue(any('Missing Custom Agent file' in e for e in validate_assets(self.root)))

    def test_invalid_yaml_syntax(self):
        path = self.root / '.agents/skills/ui-ux-design/SKILL.md'
        path.write_text('---\nname: [broken\ndescription: design\n---\nInstructions\n', encoding='utf-8')
        self.assertTrue(any('ui-ux-design' in e for e in validate_assets(self.root)))

    def test_duplicate_yaml_key(self):
        path = self.root / '.agents/skills/ui-ux-design/SKILL.md'
        path.write_text('---\nname: ui-ux-design\nname: ignored\ndescription: design\n---\nInstructions\n', encoding='utf-8')
        self.assertTrue(any('Duplicate YAML field' in e for e in validate_assets(self.root)))

    def test_invalid_toml_syntax(self):
        path = self.root / '.codex/agents/technical-reviewer.toml'
        path.write_text('name = "unterminated\n', encoding='utf-8')
        self.assertTrue(any('technical-reviewer' in e for e in validate_assets(self.root)))

    def test_profile_skill_reference_mismatch(self):
        path = self.root / '.codex/agents/frontend-developer.toml'
        path.write_text(path.read_text(encoding='utf-8').replace('.agents/skills/frontend-engineering/SKILL.md', '.agents/skills/security-audit/SKILL.md'), encoding='utf-8')
        self.assertTrue(any('explicitly reference' in e for e in validate_assets(self.root)))


if __name__ == '__main__':
    unittest.main()
