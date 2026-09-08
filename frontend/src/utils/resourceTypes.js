export const RESOURCE_TYPES = [
  { value: 'note', label: 'Notes' },
  { value: 'pyq', label: 'PYQs' },
  { value: 'assignment', label: 'Assignments' },
  { value: 'lab_manual', label: 'Lab Manuals' },
  { value: 'cheat_sheet', label: 'Cheat Sheets' },
  { value: 'question_bank', label: 'Question Banks' },
  { value: 'project', label: 'Projects' },
  { value: 'book', label: 'Books/References' },
  { value: 'other', label: 'Other' }
]

export function resourceTypeLabel(value) {
  const found = RESOURCE_TYPES.find((t) => t.value === value)
  return found ? found.label : 'Notes'
}
