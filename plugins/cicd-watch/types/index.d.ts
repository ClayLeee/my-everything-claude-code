export type WatchedProject = {
  id: string;
  host: string;
  path: string;
  ref?: string;
};

export type CommitInfo = {
  sha: string;
  title: string;
  author: string;
  at: string;
};

export type PipelineInfo = {
  id: number;
  status: string;
  sha: string;
  url: string;
  done: number;
  total: number;
  running: string[];
  jobs: JobInfo[];
};

export type JobInfo = {
  name: string;
  status: string;
  stage?: string;
};

export type StageInfo = {
  name: string;
  status: string;
  done: number;
  jobs: JobInfo[];
};

export type Snapshot = {
  ref?: string;
  commit?: CommitInfo;
  pipeline?: PipelineInfo;
  error?: string;
};

declare module "claude-code" {
  interface PluginState {
    "cicd-watch": {
      projects: WatchedProject[];
      snaps: Record<string, Snapshot>;
      checkedAt: number;
      flashes: Record<string, number>;
      tick: number;
    };
  }
}
