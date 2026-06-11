import { resolve } from 'node:path'
import type { Command } from 'commander'
import pc from 'picocolors'
import { loadConfig } from '../core/config.js'
import { buildSituation } from '../core/situation.js'
import { listLearningEvents } from '../learning/events.js'
import { developSkillsFromRecentEvents } from '../learning/develop.js'
import { manualLearnNudge } from '../learning/loop.js'
import { recallSkillsForSituation } from '../learning/recall.js'
import { getSkill, listSkills, skillSlugForSituation } from '../learning/skills.js'
import { isBackendId } from '../core/backends.js'

export function registerLearnCommands(program: Command): void {
  const learn = program.command('learn').description('Mangos self-learning loop (Hermes-style skills)')

  learn
    .command('status')
    .description('Learning loop status for this workspace')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const root = resolve(opts.directory)
      const config = await loadConfig(root)
      const situation = await buildSituation(root)
      const skills = await listSkills(root)
      const events = await listLearningEvents(root, 5)
      const recalled = await recallSkillsForSituation(root, situation, situation.backends.preferred, 3)

      console.log(pc.bold(pc.cyan('🥭 Mangos learning')))
      console.log(`  enabled: ${config.learning?.enabled !== false}`)
      console.log(`  auto_learn: ${config.learning?.auto_learn !== false}`)
      console.log(`  auto_recall: ${config.learning?.auto_recall !== false}`)
      console.log(`  auto_develop: ${config.learning?.auto_develop !== false}`)
      console.log(`  skills: ${skills.length}`)
      console.log(`  events: ${events.length} recent`)
      if (recalled.length) {
        console.log(pc.dim('  recalled now:'))
        for (const skill of recalled) {
          console.log(`    - ${skill.slug} (score ${skill.score.toFixed(1)})`)
        }
      }
      console.log(`  next slug: ${skillSlugForSituation(situation, situation.backends.preferred)}`)
    })

  learn
    .command('nudge')
    .description('Hermes-style nudge — persist a procedure note as a Mangos skill')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--note <text>', 'what worked or should be remembered', 'operator procedure')
    .option('--backend <id>', 'backend this skill targets')
    .action(async (opts: { directory: string; note: string; backend?: string }) => {
      const root = resolve(opts.directory)
      const backend = opts.backend && isBackendId(opts.backend) ? opts.backend : undefined
      const result = await manualLearnNudge(root, opts.note, backend)
      console.log(pc.green(`✓ ${result.message}`))
      if (result.skillSlug) console.log(`  skill: ${result.skillSlug}`)
      if (result.derivedSkills?.length) {
        console.log(`  derived: ${result.derivedSkills.join(', ')}`)
      }
    })

  learn
    .command('develop')
    .description('Derive new child skills from recent learning events')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--limit <n>', 'events to scan', '10')
    .action(async (opts: { directory: string; limit: string }) => {
      const root = resolve(opts.directory)
      const result = await developSkillsFromRecentEvents(root, Number(opts.limit))
      if (result.derived.length) {
        console.log(pc.green(`✓ derived ${result.derived.length} skill(s) from ${result.scanned} event(s)`))
        for (const slug of result.derived) console.log(`  - ${slug}`)
      } else {
        console.log(pc.dim(`(no new skills — scanned ${result.scanned} event(s))`))
      }
    })

  learn
    .command('events')
    .description('Recent learning events')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--limit <n>', 'max events', '10')
    .action(async (opts: { directory: string; limit: string }) => {
      const root = resolve(opts.directory)
      const events = await listLearningEvents(root, Number(opts.limit))
      for (const event of events) {
        console.log(
          `${event.recordedAt} · ${event.outcome} · ${event.mode}/${event.backend} · exit ${event.exitCode}${event.skillSlug ? ` · ${event.skillSlug}` : ''}${event.derivedSkills?.length ? ` · +${event.derivedSkills.join(',')}` : ''}`,
        )
        if (event.note) console.log(pc.dim(`  ${event.note}`))
      }
      if (!events.length) console.log(pc.dim('(no learning events yet)'))
    })

  const skills = program.command('skills').description('Mangos procedural memory (SKILL.md)')

  skills
    .command('list')
    .description('List learned skills on this Mangos Drive workspace')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (opts: { directory: string }) => {
      const root = resolve(opts.directory)
      const items = await listSkills(root)
      for (const item of items) {
        const om = item.meta.openmangos
        const parent = om.parent_skill ? ` ← ${om.parent_skill}` : ''
        console.log(
          `${item.meta.name} · ${om.mode}/${om.backend} · ${om.category} · successes ${om.success_count}${parent}`,
        )
        console.log(pc.dim(`  ${item.meta.description}`))
      }
      if (!items.length) console.log(pc.dim('(no skills yet — complete a successful om wrap session)'))
    })

  skills
    .command('show <slug>')
    .description('Show full SKILL.md content')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .action(async (slug: string, opts: { directory: string }) => {
      const root = resolve(opts.directory)
      const skill = await getSkill(root, slug)
      if (!skill) {
        console.error(pc.red(`skill not found: ${slug}`))
        process.exit(1)
      }
      console.log(`# ${skill.meta.name} (${skill.meta.version})`)
      console.log(skill.meta.description)
      console.log('')
      console.log(skill.body)
    })

  skills
    .command('recall')
    .description('Preview skills that would load for the current situation')
    .option('-C, --directory <path>', 'workspace root', process.cwd())
    .option('--backend <id>', 'backend override')
    .action(async (opts: { directory: string; backend?: string }) => {
      const root = resolve(opts.directory)
      const situation = await buildSituation(root)
      const backend =
        opts.backend && isBackendId(opts.backend) ? opts.backend : situation.backends.preferred
      const recalled = await recallSkillsForSituation(root, situation, backend)
      for (const skill of recalled) {
        console.log(`${skill.slug} (score ${skill.score.toFixed(1)}) — ${skill.meta.description}`)
      }
      if (!recalled.length) console.log(pc.dim('(no matching skills)'))
    })
}