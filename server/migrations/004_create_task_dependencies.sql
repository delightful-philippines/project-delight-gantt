-- Migration 004: task_dependencies join table
-- Normalizes the Task.dependencies[] array into a proper relation.
-- A row (task_id, depends_on_id) means: task_id depends on depends_on_id.

CREATE TABLE IF NOT EXISTS task_dependencies (
  task_id       TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  depends_on_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  PRIMARY KEY (task_id, depends_on_id)
);

CREATE INDEX IF NOT EXISTS idx_task_deps_task_id       ON task_dependencies(task_id);
CREATE INDEX IF NOT EXISTS idx_task_deps_depends_on_id ON task_dependencies(depends_on_id);
