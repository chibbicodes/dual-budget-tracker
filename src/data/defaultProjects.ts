import type { ProjectTypeConfig, ProjectStatusConfig, BudgetType } from '../types'

/**
 * Generate default project statuses
 */
export function generateDefaultProjectStatuses(): ProjectStatusConfig[] {
  const now = new Date().toISOString()

  return [
    // Performance/Business statuses
    {
      id: 'status-holding',
      name: 'Holding',
      description: 'Performance contract on hold',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'status-issued',
      name: 'Issued',
      description: 'Contract issued to client',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'status-confirmed',
      name: 'Confirmed',
      description: 'Contract confirmed by client',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'status-completed',
      name: 'Completed',
      description: 'Project completed',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'status-cancelled',
      name: 'Cancelled',
      description: 'Project cancelled',
      createdAt: now,
      updatedAt: now,
    },
    // General project statuses
    {
      id: 'status-submitted',
      name: 'Submitted',
      description: 'Proposal submitted',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'status-quoted',
      name: 'Quoted',
      description: 'Quote provided',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'status-active',
      name: 'Active',
      description: 'Project in progress',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'status-delivered',
      name: 'Delivered',
      description: 'Project delivered',
      createdAt: now,
      updatedAt: now,
    },
  ]
}

/**
 * Generate default project types with their allowed statuses
 */
export function generateDefaultProjectTypes(): ProjectTypeConfig[] {
  const now = new Date().toISOString()

  // Performance statuses: holding, issued, confirmed, completed, cancelled
  const performanceStatuses = [
    'status-holding',
    'status-issued',
    'status-confirmed',
    'status-completed',
    'status-cancelled',
  ]

  // General project statuses: submitted, quoted, confirmed, active, delivered, completed, cancelled
  const generalStatuses = [
    'status-submitted',
    'status-quoted',
    'status-confirmed',
    'status-active',
    'status-delivered',
    'status-completed',
    'status-cancelled',
  ]

  return [
    // Business project types
    {
      id: 'type-performance',
      name: 'Performance',
      budgetType: 'business' as BudgetType,
      allowedStatuses: performanceStatuses,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'type-craft',
      name: 'Craft',
      budgetType: 'business' as BudgetType,
      allowedStatuses: generalStatuses,
      createdAt: now,
      updatedAt: now,
    },
    // Household project types
    {
      id: 'type-home-improvement',
      name: 'Home Improvement',
      budgetType: 'household' as BudgetType,
      allowedStatuses: generalStatuses,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'type-party',
      name: 'Party',
      budgetType: 'household' as BudgetType,
      allowedStatuses: generalStatuses,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'type-event',
      name: 'Event',
      budgetType: 'household' as BudgetType,
      allowedStatuses: generalStatuses,
      createdAt: now,
      updatedAt: now,
    },
    // Universal
    {
      id: 'type-other',
      name: 'Other',
      budgetType: 'household' as BudgetType,
      allowedStatuses: generalStatuses,
      createdAt: now,
      updatedAt: now,
    },
  ]
}
