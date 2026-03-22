// Workflow Data Processor - Causal Link Detection Engine
// Based on: Temporal Proximity (300s rule) + Keyword Context Matching

export interface WorkflowEvent {
  id: string;
  user_id: string;
  user_name: string;
  timestamp: string;
  task_type: string;
  intent: string;
  trigger: string;
  screen_context: string;
  duration_seconds: number;
  status: 'completed' | 'in_progress' | 'blocked';
  app_switches: number;
  variables: Record<string, any>;
}

export interface CausalHandoff {
  id: string;
  from_user: string;
  to_user: string;
  from_task: string;
  to_task: string;
  gap_seconds: number;
  confidence: number;
  shared_keywords: string[];
  timestamp: string;
  value_stream: string;
}

export interface ProcessBottleneck {
  node_id: string;
  task_type: string;
  avg_duration_seconds: number;
  wait_time_ratio: number;
  context_switch_count: number;
  blocking_downstream: string[];
}

// Keyword extraction utility
const extractKeywords = (text: string): Set<string> => {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'so', 'yet', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'now']);
  
  return new Set(
    text.toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
  );
};

// Calculate Jaccard similarity between keyword sets
const keywordOverlap = (set1: Set<string>, set2: Set<string>): string[] => {
  const intersection: string[] = [];
  set1.forEach(word => {
    if (set2.has(word)) intersection.push(word);
  });
  return intersection;
};

// Main causal link detection algorithm
export const detectCausalHandoffs = (
  events: WorkflowEvent[],
  timeWindowSeconds: number = 300
): CausalHandoff[] => {
  const handoffs: CausalHandoff[] = [];
  
  // Sort events by timestamp
  const sorted = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  // Group events by user
  const userEvents = new Map<string, WorkflowEvent[]>();
  sorted.forEach(event => {
    if (!userEvents.has(event.user_id)) {
      userEvents.set(event.user_id, []);
    }
    userEvents.get(event.user_id)!.push(event);
  });
  
  // Detect handoffs between different users
  const users = Array.from(userEvents.keys());
  
  for (let i = 0; i < sorted.length; i++) {
    const eventA = sorted[i];
    
    for (let j = i + 1; j < sorted.length; j++) {
      const eventB = sorted[j];
      
      // Skip if same user
      if (eventA.user_id === eventB.user_id) continue;
      
      // Calculate time gap
      const timeA = new Date(eventA.timestamp).getTime();
      const timeB = new Date(eventB.timestamp).getTime();
      const gapSeconds = (timeB - timeA) / 1000;
      
      // Check if within time window
      if (gapSeconds > timeWindowSeconds) break; // No need to check further
      
      // Extract keywords from both events
      const keywordsA = extractKeywords(
        `${eventA.intent} ${eventA.trigger} ${eventA.screen_context} ${eventA.task_type}`
      );
      const keywordsB = extractKeywords(
        `${eventB.intent} ${eventB.trigger} ${eventB.screen_context} ${eventB.task_type}`
      );
      
      // Find shared keywords
      const shared = keywordOverlap(keywordsA, keywordsB);
      
      // Calculate confidence based on:
      // - Time proximity (closer = higher confidence)
      // - Keyword overlap (more shared = higher confidence)
      // - Sequential task logic (completed -> started)
      const timeScore = 1 - (gapSeconds / timeWindowSeconds);
      const keywordScore = shared.length / Math.max(keywordsA.size, keywordsB.size, 1);
      const statusBonus = (eventA.status === 'completed' && eventB.status === 'in_progress') ? 0.2 : 0;
      
      const confidence = Math.min(1, (timeScore * 0.4 + keywordScore * 0.4 + statusBonus + 0.1));
      
      // Only record high-confidence handoffs (>60%)
      if (confidence > 0.6 && shared.length > 0) {
        handoffs.push({
          id: `handoff-${eventA.id}-${eventB.id}`,
          from_user: eventA.user_name,
          to_user: eventB.user_name,
          from_task: eventA.task_type,
          to_task: eventB.task_type,
          gap_seconds: gapSeconds,
          confidence: confidence,
          shared_keywords: shared,
          timestamp: eventB.timestamp,
          value_stream: shared[0] || 'general'
        });
      }
    }
  }
  
  return handoffs;
};

// Detect process bottlenecks
export const detectBottlenecks = (events: WorkflowEvent[]): ProcessBottleneck[] => {
  const bottlenecks: ProcessBottleneck[] = [];
  
  // Group by task type
  const taskGroups = new Map<string, WorkflowEvent[]>();
  events.forEach(event => {
    if (!taskGroups.has(event.task_type)) {
      taskGroups.set(event.task_type, []);
    }
    taskGroups.get(event.task_type)!.push(event);
  });
  
  taskGroups.forEach((taskEvents, taskType) => {
    const avgDuration = taskEvents.reduce((sum, e) => sum + e.duration_seconds, 0) / taskEvents.length;
    const avgSwitches = taskEvents.reduce((sum, e) => sum + e.app_switches, 0) / taskEvents.length;
    
    // Calculate wait time ratio (app switches * 30s estimated distraction time)
    const estimatedWaitTime = avgSwitches * 30;
    const waitTimeRatio = estimatedWaitTime / avgDuration;
    
    // Find downstream tasks that depend on this
    const downstream = events.filter(e => 
      e.timestamp > taskEvents[taskEvents.length - 1].timestamp &&
      e.user_id !== taskEvents[0].user_id
    ).map(e => e.task_type);
    
    // Identify bottlenecks: high duration + high wait time ratio
    if (avgDuration > 600 || waitTimeRatio > 0.3) {
      bottlenecks.push({
        node_id: taskType.toLowerCase().replace(/\s+/g, '-'),
        task_type: taskType,
        avg_duration_seconds: avgDuration,
        wait_time_ratio: waitTimeRatio,
        context_switch_count: avgSwitches,
        blocking_downstream: [...new Set(downstream)].slice(0, 5)
      });
    }
  });
  
  return bottlenecks.sort((a, b) => b.wait_time_ratio - a.wait_time_ratio);
};

// Generate Mermaid chart from handoffs
export const generateCausalGraph = (handoffs: CausalHandoff[], bottlenecks: ProcessBottleneck[]): string => {
  const nodes = new Set<string>();
  const edges: string[] = [];
  const styles: string[] = [];
  
  handoffs.forEach(handoff => {
    const fromNode = handoff.from_task.replace(/\s+/g, '_');
    const toNode = handoff.to_task.replace(/\s+/g, '_');
    
    nodes.add(fromNode);
    nodes.add(toNode);
    
    const lineStyle = handoff.confidence > 0.85 ? '==>' : handoff.confidence > 0.7 ? '-->' : '-.->';
    const label = `${Math.round(handoff.gap_seconds)}s`;
    
    edges.push(`${fromNode} ${lineStyle}|${label}| ${toNode}`);
  });
  
  bottlenecks.forEach(b => {
    styles.push(`style ${b.node_id} fill:#78350f,stroke:#f59e0b,stroke-width:3px`);
  });
  
  return `graph TD
    ${edges.join('\n    ')}
    
    ${styles.join('\n    ')}`;
};
