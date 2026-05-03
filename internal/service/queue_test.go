package service

import (
	"sync"
	"testing"

	"clawbench/internal/model"

	"github.com/stretchr/testify/assert"
)

func TestEnqueueDequeue(t *testing.T) {
	// Clean up
	sessionQueues = sync.Map{}

	msg1 := model.QueuedMessage{Text: "hello", CreatedAt: "2024-01-01T00:00:00Z"}
	msg2 := model.QueuedMessage{Text: "world", CreatedAt: "2024-01-01T00:00:01Z"}

	queue := EnqueueMessage("s1", msg1)
	assert.Equal(t, 1, len(queue))
	assert.Equal(t, "hello", queue[0].Text)

	queue = EnqueueMessage("s1", msg2)
	assert.Equal(t, 2, len(queue))

	// FIFO
	dequeued, ok := DequeueMessage("s1")
	assert.True(t, ok)
	assert.Equal(t, "hello", dequeued.Text)

	dequeued, ok = DequeueMessage("s1")
	assert.True(t, ok)
	assert.Equal(t, "world", dequeued.Text)

	// Empty
	_, ok = DequeueMessage("s1")
	assert.False(t, ok)
}

func TestDequeueEmpty(t *testing.T) {
	sessionQueues = sync.Map{}
	_, ok := DequeueMessage("nonexistent")
	assert.False(t, ok)
}

func TestGetQueue(t *testing.T) {
	sessionQueues = sync.Map{}
	// Non-existent
	queue := GetQueue("nonexistent")
	assert.Nil(t, queue)

	EnqueueMessage("s1", model.QueuedMessage{Text: "a"})
	EnqueueMessage("s1", model.QueuedMessage{Text: "b"})
	queue = GetQueue("s1")
	assert.Equal(t, 2, len(queue))
	assert.Equal(t, "a", queue[0].Text)
	assert.Equal(t, "b", queue[1].Text)
}

func TestRemoveQueueItem(t *testing.T) {
	sessionQueues = sync.Map{}
	EnqueueMessage("s1", model.QueuedMessage{Text: "a"})
	EnqueueMessage("s1", model.QueuedMessage{Text: "b"})
	EnqueueMessage("s1", model.QueuedMessage{Text: "c"})

	// Remove middle
	queue := RemoveQueueItem("s1", 1)
	assert.Equal(t, 2, len(queue))
	assert.Equal(t, "a", queue[0].Text)
	assert.Equal(t, "c", queue[1].Text)

	// Remove first
	queue = RemoveQueueItem("s1", 0)
	assert.Equal(t, 1, len(queue))
	assert.Equal(t, "c", queue[0].Text)

	// Out of range - returns unchanged queue
	queue = RemoveQueueItem("s1", 5)
	assert.Equal(t, 1, len(queue))
}

func TestClearQueue(t *testing.T) {
	sessionQueues = sync.Map{}
	EnqueueMessage("s1", model.QueuedMessage{Text: "a"})
	ClearQueue("s1")
	assert.Equal(t, 0, QueueLength("s1"))

	// Clear non-existent is no-op
	ClearQueue("nonexistent")
}

func TestQueueLength(t *testing.T) {
	sessionQueues = sync.Map{}
	assert.Equal(t, 0, QueueLength("s1"))
	EnqueueMessage("s1", model.QueuedMessage{Text: "a"})
	assert.Equal(t, 1, QueueLength("s1"))
}

func TestQueueConcurrentSafety(t *testing.T) {
	sessionQueues = sync.Map{}
	var wg sync.WaitGroup
	for i := 0; i < 100; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			EnqueueMessage("s1", model.QueuedMessage{Text: string(rune(n))})
		}(i)
	}
	wg.Wait()
	assert.Equal(t, 100, QueueLength("s1"))
}
