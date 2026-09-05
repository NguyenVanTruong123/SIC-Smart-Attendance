interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly VITE_ENABLE_DEMO_ACCOUNTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
