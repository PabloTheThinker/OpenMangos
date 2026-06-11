import { join } from 'node:path'
import { loadConfig } from '../core/config.js'
import { buildSituation } from '../core/situation.js'
import { recordToAgentDrive } from '../integrations/agentdrive.js'
import { resolveAgentDriveSwarms } from '../integrations/agentdrive-swarm.js'
import { suggestVerificationCommands } from '../core/agents-md.js'
import type { BackendId, LearningConfig, LearningEvent, SituationGraph } from '../types.js'
import type { VerificationResult } from '../verify/types.js'
import { appendLearningEvent } from './events.js'
import { recallSkillsForSituation } from './recall.js'
import { developSkillsFromSession } from './develop.js'
import { skillSlugForSituation, upsertSkill } from './skills.js'

export interface SessionExitContext {
  root: string
  sessionId?: string
  backend: BackendId
  situation: SituationGraph
  exitCode: number
  signal?: string | null
  verification?: VerificationResult
}

export interface LearningLoopResult {
  event: LearningEvent
  skillSlug?: string
  skillCreated?: boolean
  derivedSkills?: string[]
  message: string
}

function learningConfig(config: Awaited<ReturnType<typeof loadConfig>>): LearningConfig {
  return {
    enabled: config.learning?.enabled !== false,
    auto_learn: config.learning?.auto_learn !== false,
    auto_recall: config.learning?.auto_recall !== false,
    nudge_agents: config.learning?.nudge_agents !== false,
    auto_develop: config.learning?.auto_develop !== false,
    min_success_exit_code: config.learning?.min_success_exit_code ?? 0,
    ...config.learning,
  }
}

function sessionSucceeded(ctx: SessionExitContext, cfg: LearningConfig): boolean {
  if (ctx.signal) return false
  if (ctx.exitCode !== (cfg.min_success_exit_code ?? 0)) return false
  if (ctx.verification && !ctx.verification.ok) return false
  return true
}

export async function runLearningLoopOnExit(ctx: SessionExitContext): Promise<LearningLoopResult> {
  const config = await loadConfig(ctx.root)
  const cfg = learningConfig(config)
  const succeeded = sessionSucceeded(ctx, cfg)

  const event = await appendLearningEvent(ctx.root, {
    sessionId: ctx.sessionId,
    backend: ctx.backend,
    mode: ctx.situation.mode,
    stack: ctx.situation.stack,
    workspace: ctx.situation.workspace,
    exitCode: ctx.exitCode,
    signal: ctx.signal ?? undefined,
    verificationOk: ctx.verification?.ok,
    outcome: succeeded ? 'success' : 'failure',
    skillSlug: undefined,
  })

  if (!cfg.enabled) {
    return { event, message: 'learning disabled' }
  }

  if (!succeeded) {
    const parentSlug = skillSlugForSituation(ctx.situation, ctx.backend)
    let derivedSkills: string[] = []
    if (cfg.auto_develop) {
      derivedSkills = await developSkillsFromSession(ctx.root, {
        situation: ctx.situation,
        backend: ctx.backend,
        parentSlug,
        verification: ctx.verification,
        outcome: 'failure',
        verificationCommands: suggestVerificationCommands(ctx.situation),
      })
      event.derivedSkills = derivedSkills
      event.skillSlug = parentSlug
    }
    const msg =
      derivedSkills.length ?
        `failure recorded · derived recovery skill(s): ${derivedSkills.join(', ')}`
      : 'session outcome recorded'
    return { event, derivedSkills, message: msg }
  }

  if (!cfg.auto_learn) {
    return { event, message: 'learning recorded (auto_learn off)' }
  }

  const verificationCommands = suggestVerificationCommands(ctx.situation)
  const learnedFrom = [
    `session ${ctx.sessionId ?? 'unknown'}`,
    `exit ${ctx.exitCode}`,
    ctx.verification ? `verify ${ctx.verification.ok ? 'pass' : 'fail'}` : 'verify skipped',
    new Date().toISOString(),
  ].join(' · ')

  const { slug, created, meta } = await upsertSkill(ctx.root, ctx.situation, ctx.backend, {
    learnedFrom,
    verificationCommands,
    incrementSuccess: true,
  })

  event.skillSlug = slug

  let derivedSkills: string[] = []
  if (cfg.auto_develop) {
    derivedSkills = await developSkillsFromSession(ctx.root, {
      situation: ctx.situation,
      backend: ctx.backend,
      parentSlug: slug,
      verification: ctx.verification,
      outcome: 'success',
      verificationCommands,
    })
    event.derivedSkills = derivedSkills
    for (const child of derivedSkills) {
      await recordLearningToMangosDrive(
        ctx.root,
        ctx.situation,
        config,
        child,
        `derived skill from ${slug}`,
      )
    }
  }

  await recordLearningToMangosDrive(ctx.root, ctx.situation, config, slug, meta.description)

  const derivedMsg =
    derivedSkills.length ? ` · derived ${derivedSkills.length} new skill(s)` : ''
  return {
    event,
    skillSlug: slug,
    skillCreated: created,
    derivedSkills,
    message: `${created ? 'new' : 'updated'} Mangos skill: ${slug}${derivedMsg}`,
  }
}

async function recordLearningToMangosDrive(
  root: string,
  situation: SituationGraph,
  config: Awaited<ReturnType<typeof loadConfig>>,
  skillSlug: string,
  description: string,
): Promise<void> {
  if (config.agentdrive?.enabled === false || config.agentdrive?.auto_remember === false) return
  const swarms = await resolveAgentDriveSwarms(root, situation, config.agentdrive ?? {})
  const reasoningFile = join(root, '.openmangos', 'learning', 'skills', skillSlug, 'SKILL.md')
  const summary = `OpenMangos skill learned: ${skillSlug} — ${description}`
  await recordToAgentDrive(root, situation, config.agentdrive ?? {}, swarms.workspaceSwarmId, {
    summary,
    reasoningFile,
  })
}

export async function manualLearnNudge(
  root: string,
  note: string,
  backend?: BackendId,
): Promise<LearningLoopResult> {
  const config = await loadConfig(root)
  const cfg = learningConfig(config)
  if (!cfg.enabled) {
    throw new Error('learning disabled in config')
  }

  const situation = await buildSituation(root)
  const resolvedBackend = backend ?? situation.backends.preferred
  const verificationCommands = suggestVerificationCommands(situation)
  const learnedFrom = `manual nudge · ${note} · ${new Date().toISOString()}`

  const { slug, created, meta } = await upsertSkill(root, situation, resolvedBackend, {
    learnedFrom,
    verificationCommands,
    incrementSuccess: false,
  })

  const event = await appendLearningEvent(root, {
    backend: resolvedBackend,
    mode: situation.mode,
    stack: situation.stack,
    workspace: situation.workspace,
    exitCode: 0,
    outcome: 'nudge',
    skillSlug: slug,
    note,
  })

  await recordLearningToMangosDrive(root, situation, config, slug, meta.description)

  let derivedSkills: string[] = []
  if (cfg.auto_develop) {
    derivedSkills = await developSkillsFromSession(root, {
      situation,
      backend: resolvedBackend,
      parentSlug: slug,
      outcome: 'nudge',
      note,
      verificationCommands,
    })
    event.derivedSkills = derivedSkills
  }

  const derivedMsg =
    derivedSkills.length ? ` · forked ${derivedSkills.length} skill(s)` : ''
  return {
    event,
    skillSlug: slug,
    skillCreated: created,
    derivedSkills,
    message: `persisted skill ${slug} from nudge${derivedMsg}`,
  }
}

export async function shouldRecallSkills(root: string): Promise<boolean> {
  const config = await loadConfig(root)
  const cfg = learningConfig(config)
  return cfg.enabled && cfg.auto_recall !== false
}

export async function gatherLearnedSkills(
  root: string,
  situation: SituationGraph,
  backend?: BackendId,
) {
  if (!(await shouldRecallSkills(root))) return []
  return recallSkillsForSituation(root, situation, backend)
}