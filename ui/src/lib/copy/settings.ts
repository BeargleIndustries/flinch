// Settings drawer copy (brief 9.7, D10, D11, D25). Brief A.6 has no keys for
// the drawer, so its strings live here (brief 5.7 rule 9) and in COPY_FILES.
// The settings sections and settings.spec.ts read them; KEY_ROW is the
// wording of one provider key row (KeyRow.svelte and key-row.ts).

const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

export const SETTINGS = {
  // Keys (9.7, D11)
  keysHeading: 'Keys',
  keysLeadDesktop:
    'Keys are saved in Windows Credential Manager and handed to the sidecar when it starts.',
  keysLeadDev:
    'Keys are saved to the .env file next to the project and loaded when the sidecar starts.',
  keysFoot:
    'Flinch needs one key for the classifier and the coach. Anthropic is used first when it is set.',
  keysLoading: 'Reading the keys…',
  keysFailed: 'Could not read the keys.',
  retry: 'Try again',

  // Local models (9.7)
  ollamaHeading: 'Local models (Ollama)',
  ollamaUrl: 'Base URL',
  ollamaTest: 'Test the connection',
  ollamaTesting: 'Testing…',
  ollamaConnected: (n: number) => `Connected (${n} ${plural(n, 'model', 'models')})`,
  ollamaNotRunning: 'Not running',
  ollamaSaved: 'Saved.',
  ollamaHint: 'Install Ollama from ollama.com, then run ollama pull llama3.2 to try a local model.',
  ollamaEmpty: 'Enter the address Ollama listens on.',

  // Coach (9.7)
  coachHeading: 'Coach',
  coachBackend: 'Default backend',
  coachModel: 'Local model',
  coachModelPlaceholder: 'llama3.2',
  coachHint: 'Used for new sessions. Each session can choose its own.',
  coachSaved: 'Saved.',

  // Developer (D25)
  devHeading: 'Developer',
  database: 'Database',
  versions: 'Versions',
  versionLine: (app: string, sidecar: string) => `App ${app} · Sidecar ${sidecar}`,
  apiDocs: 'API docs',
  apiDocsLink: 'Open the API docs',
  devtools: 'Open DevTools',
  devtoolsAuto: 'Open DevTools when Flinch starts',
  diagnostic: 'Copy diagnostic details',
  copied: 'Copied',
  crashLogs: 'Crash logs',
  crashLogsNone: 'None',
} as const;

/** One provider key row (brief 9.7, 5.6 `KeyRow`). */
export const KEY_ROW = {
  set: 'Set',
  setMasked: (masked: string) => `Set · ${masked}`,
  notSet: 'Not set',
  saved: 'Saved.',
  didNotWork: (error: string) => `That key did not work: ${error}`,
  works: 'Key works.',
  testFailed: (error: string) => `Test failed: ${error}`,
  test: 'Test',
  testing: 'Testing…',
  checkedWhenSaved: 'Checked when saved.',
  remove: 'Remove',
  removeConfirm: (label: string) => `Remove the ${label} key`,
  cancel: 'Cancel',
  replace: 'Replace',
  add: 'Add a key',
  field: (label: string) => `${label} API key`,
  save: 'Save',
  saving: 'Saving…',
} as const;
