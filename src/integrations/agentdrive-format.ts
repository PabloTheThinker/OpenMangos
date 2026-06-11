import type { AgentDriveContextSummary } from '../types.js'

type RawContextPack = {
  swarm_id?: string
  fabric_coherence?: number
  lookback_days?: number
  reasoning_style?: string
  compact_graph_summary?: string
  actionable_structural_recommendations?: string[]
  top_weak_clusters?: Array<{
    cycle_id?: string
    why_actionable?: string
    coherence?: number
  }>
}

export function parseAgentDriveContextPack(raw: string): AgentDriveContextSummary | null {
  try {
    const parsed = JSON.parse(raw) as { context_pack?: RawContextPack } & RawContextPack
    const cp = parsed.context_pack ?? parsed
    if (typeof cp !== 'object' || cp === null) return null

    return {
      swarmId: cp.swarm_id,
      fabricCoherence: cp.fabric_coherence,
      lookbackDays: cp.lookback_days,
      reasoningStyle: cp.reasoning_style,
      compactSummary: cp.compact_graph_summary,
      recommendations: Array.isArray(cp.actionable_structural_recommendations) ?
        cp.actionable_structural_recommendations
      : undefined,
      weakClusters: (cp.top_weak_clusters ?? []).slice(0, 3).map((cluster) => ({
        cycleId: cluster.cycle_id ?? 'unknown',
        whyActionable: cluster.why_actionable,
        coherence: cluster.coherence,
      })),
      source: 'agentdrive',
    }
  } catch {
    return null
  }
}

export function agentDriveContextToMarkdown(
  context: AgentDriveContextSummary,
  title = 'Cross-session memory (AgentDrive)',
): string[] {
  const lines: string[] = [`## ${title}`, '']
  if (context.swarmId) lines.push(`- **Swarm:** ${context.swarmId}`)
  if (context.fabricCoherence !== undefined) {
    lines.push(`- **Fabric coherence:** ${context.fabricCoherence}`)
  }
  if (context.lookbackDays !== undefined) {
    lines.push(`- **Lookback:** ${context.lookbackDays} days`)
  }
  if (context.reasoningStyle) lines.push(`- **Reasoning style:** ${context.reasoningStyle}`)
  if (context.compactSummary) {
    lines.push('')
    lines.push('### Graph summary')
    lines.push('')
    lines.push(context.compactSummary)
  }
  if (context.recommendations?.length) {
    lines.push('')
    lines.push('### Structural recommendations')
    lines.push('')
    for (const rec of context.recommendations) lines.push(`- ${rec}`)
  }
  if (context.weakClusters?.length) {
    lines.push('')
    lines.push('### Actionable weak clusters')
    lines.push('')
    for (const cluster of context.weakClusters) {
      const coh =
        cluster.coherence !== undefined ? ` (coh=${cluster.coherence})` : ''
      lines.push(`- **${cluster.cycleId}**${coh}`)
      if (cluster.whyActionable) lines.push(`  ${cluster.whyActionable}`)
    }
  }
  lines.push('')
  lines.push(
    'Use this structural memory to inform decisions; prefer proven patterns from the Experience Graph.',
  )
  lines.push('')
  return lines
}