// Sample Mate Workflow Data - Represents Real Activity Tracker Output
// This would normally come from the Mate API/Database

import type { WorkflowEvent } from './workflow-processor';

export const sampleWorkflowEvents: WorkflowEvent[] = [
  // === Customer Operations Chain ===
  {
    id: 'wf-001',
    user_id: 'user-abel',
    user_name: 'Abel',
    timestamp: '2026-03-19T09:15:00Z',
    task_type: 'Handle Customer Call',
    intent: 'Customer requested withdrawal for SEAF account',
    trigger: 'Incoming call from +251912345678',
    screen_context: 'ChipChip 360 Dashboard - Customer Profile',
    duration_seconds: 420,
    status: 'completed',
    app_switches: 2,
    variables: { customer_id: 'SEAF-2024-001', request_type: 'withdrawal' }
  },
  {
    id: 'wf-002',
    user_id: 'user-abel',
    user_name: 'Abel',
    timestamp: '2026-03-19T09:22:00Z',
    task_type: 'Account Lookup',
    intent: 'Verify SEAF account details for withdrawal',
    trigger: 'Customer call continuation',
    screen_context: 'ChipChip 360 - Account Management',
    duration_seconds: 180,
    status: 'completed',
    app_switches: 1,
    variables: { account_verified: true }
  },
  {
    id: 'wf-003',
    user_id: 'user-beza',
    user_name: 'Beza',
    timestamp: '2026-03-19T09:28:30Z',
    task_type: 'Process Withdrawal',
    intent: 'Execute SEAF withdrawal request',
    trigger: 'Handoff from Abel - Customer Call',
    screen_context: 'ChipChip 360 - Transaction Processing',
    duration_seconds: 540,
    status: 'completed',
    app_switches: 3,
    variables: { withdrawal_amount: 5000, currency: 'ETB' }
  },
  
  // === Audit & Compliance Chain ===
  {
    id: 'wf-004',
    user_id: 'user-daniel',
    user_name: 'Daniel',
    timestamp: '2026-03-19T10:30:00Z',
    task_type: 'WFP Audit Compliance',
    intent: 'Prepare WFP audit documentation',
    trigger: 'Monthly audit cycle',
    screen_context: 'WFP Portal - Compliance Dashboard',
    duration_seconds: 1800,
    status: 'completed',
    app_switches: 8,
    variables: { audit_period: 'Q1-2026' }
  },
  {
    id: 'wf-005',
    user_id: 'user-daniel',
    user_name: 'Daniel',
    timestamp: '2026-03-19T11:05:00Z',
    task_type: 'Reconcile Personnel Exp',
    intent: 'Cross-check WFP personnel expenses',
    trigger: 'WFP Audit continuation',
    screen_context: 'Excel - Personnel Expense Tracker',
    duration_seconds: 1200,
    status: 'completed',
    app_switches: 5,
    variables: { reconciled: true }
  },
  {
    id: 'wf-006',
    user_id: 'user-hanna',
    user_name: 'Hanna',
    timestamp: '2026-03-19T11:15:00Z',
    task_type: 'SEAF Scorecard Entry',
    intent: 'Update SEAF scorecard with WFP data',
    trigger: 'WFP Audit data ready',
    screen_context: 'Google Sheets - SEAF Scorecard 2026',
    duration_seconds: 1740,
    status: 'completed',
    app_switches: 12,
    variables: { entries_added: 15 }
  },
  
  // === Strategy & Management Chain ===
  {
    id: 'wf-007',
    user_id: 'user-beck',
    user_name: 'Beck',
    timestamp: '2026-03-19T08:00:00Z',
    task_type: 'Review Activity Reports',
    intent: 'Daily standup review of team metrics',
    trigger: 'Morning routine',
    screen_context: 'Nova Ops Dashboard - Overview',
    duration_seconds: 900,
    status: 'completed',
    app_switches: 3,
    variables: { reports_reviewed: 5 }
  },
  {
    id: 'wf-008',
    user_id: 'user-beck',
    user_name: 'Beck',
    timestamp: '2026-03-19T08:20:00Z',
    task_type: 'AI Team Call',
    intent: 'Strategy sync with Luc on AI roadmap',
    trigger: 'Scheduled meeting',
    screen_context: 'Google Meet - AI Strategy',
    duration_seconds: 2700,
    status: 'completed',
    app_switches: 1,
    variables: { participants: ['Beck', 'Luc', 'Nova'] }
  },
  {
    id: 'wf-009',
    user_id: 'user-sara',
    user_name: 'Sara',
    timestamp: '2026-03-19T09:05:00Z',
    task_type: 'Investor Day Prep',
    intent: 'Prepare materials for investor presentation',
    trigger: 'Handoff from Beck - AI Call decisions',
    screen_context: 'Keynote - Investor Deck Draft',
    duration_seconds: 3600,
    status: 'in_progress',
    app_switches: 4,
    variables: { deck_version: 'v3.2' }
  },
  
  // === Creative/Marketing Chain ===
  {
    id: 'wf-010',
    user_id: 'user-meron',
    user_name: 'Meron',
    timestamp: '2026-03-19T10:00:00Z',
    task_type: 'Content Planning',
    intent: 'Plan Avocado export marketing content',
    trigger: 'Weekly content calendar',
    screen_context: 'Notion - Content Calendar Q1',
    duration_seconds: 1800,
    status: 'completed',
    app_switches: 6,
    variables: { content_pieces: 8 }
  },
  {
    id: 'wf-011',
    user_id: 'user-meron',
    user_name: 'Meron',
    timestamp: '2026-03-19T10:35:00Z',
    task_type: 'Avocado Export Presentation',
    intent: 'Create Avocado export pitch deck',
    trigger: 'Content planning output',
    screen_context: 'PowerPoint - Avocado Export Deck',
    duration_seconds: 2400,
    status: 'completed',
    app_switches: 4,
    variables: { slides: 12 }
  },
  {
    id: 'wf-012',
    user_id: 'user-yohannes',
    user_name: 'Yohannes',
    timestamp: '2026-03-19T11:20:00Z',
    task_type: 'Review Export Financials',
    intent: 'Validate Avocado export projections',
    trigger: 'Merons presentation needs financial review',
    screen_context: 'Excel - Avocado Export Financial Model',
    duration_seconds: 1500,
    status: 'completed',
    app_switches: 2,
    variables: { approved: true }
  },
  
  // === Cross-Department Handoffs ===
  {
    id: 'wf-013',
    user_id: 'user-daniel',
    user_name: 'Daniel',
    timestamp: '2026-03-19T11:45:00Z',
    task_type: 'Review Weekly KPI',
    intent: 'Cross-check SEAF metrics with export numbers',
    trigger: 'SEAF scorecard complete',
    screen_context: 'Google Sheets - Weekly KPI Dashboard',
    duration_seconds: 900,
    status: 'completed',
    app_switches: 3,
    variables: { kpi_status: 'green' }
  },
  
  // === Network Troubleshooting (Bottleneck Example) ===
  {
    id: 'wf-014',
    user_id: 'user-abel',
    user_name: 'Abel',
    timestamp: '2026-03-19T14:00:00Z',
    task_type: 'Network Troubleshooting',
    intent: 'Resolve connectivity issues for ChipChip 360',
    trigger: 'System alert - high latency',
    screen_context: 'Terminal - Network Diagnostics',
    duration_seconds: 2100,
    status: 'completed',
    app_switches: 15,
    variables: { issue_resolved: true, root_cause: 'DNS timeout' }
  },
  
  // === JICA Meeting Prep (Blocked by SEAF) ===
  {
    id: 'wf-015',
    user_id: 'user-beck',
    user_name: 'Beck',
    timestamp: '2026-03-19T12:00:00Z',
    task_type: 'JICA Meeting Prep',
    intent: 'Prepare JICA partnership meeting agenda',
    trigger: 'Scheduled meeting tomorrow',
    screen_context: 'Google Docs - JICA Meeting Notes',
    duration_seconds: 600,
    status: 'blocked',
    app_switches: 7,
    variables: { blocked_reason: 'Waiting for SEAF scorecard validation' }
  }
];

// Value Stream Definitions
export const valueStreams = [
  {
    name: 'Customer Operations',
    color: '#3b82f6',
    tasks: ['Handle Customer Call', 'Account Lookup', 'Process Withdrawal', 'Process Refund']
  },
  {
    name: 'Audit & Compliance',
    color: '#10b981',
    tasks: ['WFP Audit Compliance', 'Reconcile Personnel Exp', 'SEAF Scorecard Entry', 'Review Weekly KPI']
  },
  {
    name: 'Strategy & Management',
    color: '#6366f1',
    tasks: ['Review Activity Reports', 'AI Team Call', 'Investor Day Prep', 'JICA Meeting Prep']
  },
  {
    name: 'Creative/Marketing',
    color: '#d946ef',
    tasks: ['Content Planning', 'Avocado Export Presentation', 'Review Export Financials']
  },
  {
    name: 'Technical Support',
    color: '#f59e0b',
    tasks: ['Network Troubleshooting', 'System Maintenance']
  }
];

// User Department Mapping
export const userDepartments: Record<string, string> = {
  'Abel': 'Customer Operations',
  'Beza': 'Customer Operations',
  'Daniel': 'Audit & Compliance',
  'Hanna': 'Audit & Compliance',
  'Beck': 'Strategy & Management',
  'Sara': 'Strategy & Management',
  'Meron': 'Creative/Marketing',
  'Yohannes': 'Creative/Marketing'
};
