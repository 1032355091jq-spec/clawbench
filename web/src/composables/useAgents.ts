import { ref } from 'vue'
import { apiGet } from '@/utils/api.ts'
import { gt } from '@/composables/useLocale'

// Singleton state — shared across the whole app
const agents = ref<any[]>([])
const defaultAgentId = ref('')
let loadPromise: Promise<void> | null = null

async function loadAgents(): Promise<void> {
    if (agents.value.length > 0) return // already loaded
    if (loadPromise) return loadPromise  // load in progress

    loadPromise = (async () => {
        try {
            const data = await apiGet<{ agents: any[]; defaultAgent?: string }>('/api/agents')
            agents.value = data.agents || []
            if (data.defaultAgent) {
                defaultAgentId.value = data.defaultAgent
            }
        } catch (err) {
            console.error('Failed to load agents:', err)
        } finally {
            loadPromise = null
        }
    })()
    return loadPromise
}

function getAgentIcon(agentId: string): string {
    const agent = agents.value.find(a => a.id === agentId)
    return agent ? agent.icon : '🤖'
}

function getAgentName(agentId: string): string {
    const agent = agents.value.find(a => a.id === agentId)
    return agent ? agent.name : (agentId || gt('agents.defaultAssistant'))
}

function isDefaultAgent(agentId: string): boolean {
    return agentId === defaultAgentId.value
}

export function useAgents() {
    return {
        agents,
        defaultAgentId,
        loadAgents,
        getAgentIcon,
        getAgentName,
        isDefaultAgent,
    }
}
