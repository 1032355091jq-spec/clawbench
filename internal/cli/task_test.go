package cli

import (
	"os"
	"testing"

	"clawbench/internal/model"
	"clawbench/internal/service"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func setupTestEnv(t *testing.T) {
	t.Helper()
	tmpDir := t.TempDir()
	model.BinDir = tmpDir
	model.ConfigInstance = model.Config{WatchDir: tmpDir}

	err := service.InitDB()
	require.NoError(t, err)

	scheduler := service.NewScheduler()
	service.GlobalScheduler = scheduler
}

func TestRunTaskCommand_NoArgs(t *testing.T) {
	exitCode := RunTaskCommand([]string{})
	assert.Equal(t, 1, exitCode)
}

func TestRunTaskCommand_UnknownSubcommand(t *testing.T) {
	exitCode := RunTaskCommand([]string{"foo"})
	assert.Equal(t, 1, exitCode)
}

func TestCreateTask(t *testing.T) {
	setupTestEnv(t)

	exitCode := RunTaskCommand([]string{
		"create",
		"--name", "Test Task",
		"--cron", "0 9 * * *",
		"--agent", "codebuddy",
		"--prompt", "Summarize commits",
		"--repeat", "unlimited",
	})
	assert.Equal(t, 0, exitCode)
}

func TestCreateTask_MissingFields(t *testing.T) {
	setupTestEnv(t)

	exitCode := RunTaskCommand([]string{
		"create",
		"--name", "Test Task",
	})
	assert.Equal(t, 1, exitCode)
}

func TestCreateTask_ScheduledExecution(t *testing.T) {
	setupTestEnv(t)

	os.Setenv("CLAWBENCH_SCHEDULED", "1")
	defer os.Unsetenv("CLAWBENCH_SCHEDULED")

	exitCode := RunTaskCommand([]string{
		"create",
		"--name", "Test Task",
		"--cron", "0 9 * * *",
		"--agent", "codebuddy",
		"--prompt", "Test",
	})
	assert.Equal(t, 1, exitCode)
}

func TestCreateTask_LimitedRepeatWithoutMaxRuns(t *testing.T) {
	setupTestEnv(t)

	exitCode := RunTaskCommand([]string{
		"create",
		"--name", "Test Task",
		"--cron", "0 9 * * *",
		"--agent", "codebuddy",
		"--prompt", "Test",
		"--repeat", "limited",
	})
	assert.Equal(t, 1, exitCode)
}

func TestUpdateTask(t *testing.T) {
	setupTestEnv(t)

	exitCode := RunTaskCommand([]string{
		"create",
		"--name", "Original",
		"--cron", "0 9 * * *",
		"--agent", "codebuddy",
		"--prompt", "Test",
	})
	assert.Equal(t, 0, exitCode)

	tasks, err := service.GetTasks(model.ConfigInstance.WatchDir)
	require.NoError(t, err)
	require.Len(t, tasks, 1)
	taskID := tasks[0].ID

	exitCode = RunTaskCommand([]string{
		"update", taskID,
		"--name", "Updated",
	})
	assert.Equal(t, 0, exitCode)
}

func TestDeleteTask(t *testing.T) {
	setupTestEnv(t)

	RunTaskCommand([]string{
		"create",
		"--name", "To Delete",
		"--cron", "0 9 * * *",
		"--agent", "codebuddy",
		"--prompt", "Test",
	})

	tasks, _ := service.GetTasks(model.ConfigInstance.WatchDir)
	taskID := tasks[0].ID

	exitCode := RunTaskCommand([]string{"delete", taskID})
	assert.Equal(t, 0, exitCode)
}

func TestPauseResumeTask(t *testing.T) {
	setupTestEnv(t)

	RunTaskCommand([]string{
		"create",
		"--name", "Pausable",
		"--cron", "0 9 * * *",
		"--agent", "codebuddy",
		"--prompt", "Test",
	})

	tasks, _ := service.GetTasks(model.ConfigInstance.WatchDir)
	taskID := tasks[0].ID

	exitCode := RunTaskCommand([]string{"pause", taskID})
	assert.Equal(t, 0, exitCode)

	exitCode = RunTaskCommand([]string{"resume", taskID})
	assert.Equal(t, 0, exitCode)
}

func TestTaskNotFound(t *testing.T) {
	setupTestEnv(t)

	exitCode := RunTaskCommand([]string{"delete", "nonexistent-id"})
	assert.Equal(t, 1, exitCode)
}
