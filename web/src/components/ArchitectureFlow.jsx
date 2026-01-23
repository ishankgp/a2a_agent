// ArchitectureFlow.jsx - Interactive agent pipeline visualization with Agent Cards
import { motion } from "framer-motion";
import { Bot, ArrowRight, Search, FileCheck, Presentation, Router, Globe, Zap, Shield } from "lucide-react";
import { useState, useEffect } from "react";
import A2AMessageLog from "./A2AMessageLog"; // Import Log Component

// API endpoint for fetching agent cards
const AGENT_CARD_URLS = {
    triage: "http://localhost:8000/triage/.well-known/agent-card.json",
    research: "http://localhost:8000/research/.well-known/agent-card.json",
    review: "http://localhost:8000/review/.well-known/agent-card.json",
    presentation: "http://localhost:8000/presentation/.well-known/agent-card.json"
};

// Fallback info if agent card fetch fails
const AGENT_INFO = {
    triage: {
        name: "Triage Agent",
        role: "Intelligent Router",
        description: "Routes incoming requests to research or presentation agents.",
        icon: Router,
        color: "#8B5CF6"
    },
    research: {
        name: "Medical Research Agent",
        role: "The Investigator",
        description: "Summarizes medical research with structured outputs.",
        icon: Search,
        color: "#3B82F6"
    },
    review: {
        name: "Review Agent",
        role: "The Critic",
        description: "Reviews medical summaries for clarity and compliance notes.",
        icon: FileCheck,
        color: "#10B981"
    },
    presentation: {
        name: "Presentation Agent",
        role: "The Designer",
        description: "Generates Gamma presentations from outlines.",
        icon: Presentation,
        color: "#F59E0B"
    }
};

const getStatusColor = (status) => {
    switch (status) {
        case "Working": return "#22C55E";
        case "Completed": return "#3B82F6";
        case "Failed": return "#EF4444";
        case "Skipped": return "#6B7280";
        default: return "#4B5563";
    }
};

function AgentNode({ agent, status, onClick, isActive }) {
    const info = AGENT_INFO[agent];
    const Icon = info.icon;
    const statusColor = getStatusColor(status);

    return (
        <motion.div
            className="relative cursor-pointer"
            onClick={() => onClick(agent)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
        >
            <motion.div
                className="w-32 h-32 rounded-2xl border-2 flex flex-col items-center justify-center gap-2 backdrop-blur-sm"
                style={{
                    borderColor: info.color,
                    backgroundColor: `${info.color}15`,
                    boxShadow: isActive ? `0 0 20px ${info.color}40` : 'none'
                }}
                animate={status === "Working" ? {
                    boxShadow: [`0 0 10px ${info.color}40`, `0 0 30px ${info.color}60`, `0 0 10px ${info.color}40`]
                } : {}}
                transition={{ repeat: Infinity, duration: 1.5 }}
            >
                <Icon size={28} style={{ color: info.color }} />
                <span className="text-xs font-semibold text-white text-center px-2">{info.name}</span>
                <span className="text-[10px] text-gray-400">{info.role}</span>
            </motion.div>

            <motion.div
                className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-medium"
                style={{ backgroundColor: statusColor, color: 'white' }}
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
            >
                {status}
            </motion.div>
        </motion.div>
    );
}

function ConnectionLine({ isActive }) {
    return (
        <div className="flex items-center">
            <motion.div
                className="h-0.5 w-12 relative overflow-hidden"
                style={{ backgroundColor: isActive ? '#22C55E' : '#374151' }}
            >
                {isActive && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent"
                        animate={{ x: ['-100%', '100%'] }}
                        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    />
                )}
            </motion.div>
            <ArrowRight size={16} className={isActive ? 'text-green-500' : 'text-gray-600'} />
        </div>
    );
}

// Agent Card Detail Panel
function AgentCardPanel({ agent, agentCard, fallbackInfo }) {
    const info = fallbackInfo;
    const card = agentCard;

    return (
        <motion.div
            className="mx-auto max-w-2xl p-6 rounded-2xl border border-gray-700 bg-gray-800/50 backdrop-blur-sm"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={agent}
        >
            {/* Header */}
            <div className="flex items-center gap-4 mb-4">
                <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${info.color}20` }}
                >
                    <info.icon size={28} style={{ color: info.color }} />
                </div>
                <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">{card?.name || info.name}</h3>
                    <p className="text-sm" style={{ color: info.color }}>{info.role}</p>
                </div>
                {card?.url && (
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-gray-700/50 text-xs text-gray-300">
                        <Globe size={12} />
                        {card.url}
                    </div>
                )}
            </div>

            {/* Description */}
            <p className="text-sm text-gray-300 leading-relaxed mb-4">
                {card?.description || info.description}
            </p>

            {/* Capabilities */}
            {card?.capabilities && (
                <div className="mb-4">
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <Zap size={12} />
                        <span className="uppercase tracking-wider">Capabilities</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(card.capabilities).map(([key, value]) => (
                            <span key={key} className="px-2 py-1 rounded-md bg-gray-700/50 text-xs text-gray-300">
                                {key}: {value ? "✓" : "✗"}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Skills */}
            {card?.skills?.length > 0 && (
                <div>
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
                        <Shield size={12} />
                        <span className="uppercase tracking-wider">Skills</span>
                    </div>
                    <div className="space-y-3">
                        {card.skills.map((skill, idx) => (
                            <div key={idx} className="p-3 rounded-lg bg-gray-900/50 border border-gray-700">
                                <div className="font-medium text-sm text-white mb-1">{skill.name}</div>
                                <div className="text-xs text-gray-400 mb-2">{skill.description}</div>
                                {skill.examples?.length > 0 && (
                                    <div className="text-xs text-gray-500 italic">
                                        Example: "{skill.examples[0]}"
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Authentication */}
            {card?.authentication && (
                <div className="mt-4 pt-4 border-t border-gray-700 flex items-center gap-2 text-xs text-gray-500">
                    <Shield size={12} />
                    Auth: {card.authentication.type}
                </div>
            )}
        </motion.div>
    );
}

export default function ArchitectureFlow({ pipelineState, a2aMessages = [] }) {
    const [selectedAgent, setSelectedAgent] = useState(null);
    const [agentCards, setAgentCards] = useState({});
    const [loading, setLoading] = useState(false);

    // Fetch agent card when an agent is selected
    useEffect(() => {
        if (!selectedAgent) return;
        if (agentCards[selectedAgent]) return; // Already fetched

        setLoading(true);
        fetch(AGENT_CARD_URLS[selectedAgent])
            .then(res => res.ok ? res.json() : null)
            .then(data => {
                if (data) {
                    setAgentCards(prev => ({ ...prev, [selectedAgent]: data }));
                }
            })
            .catch(() => { }) // Silently fail, use fallback
            .finally(() => setLoading(false));
    }, [selectedAgent]);

    const triageActive = pipelineState.triage === "Working" || pipelineState.triage === "Completed";
    const researchActive = pipelineState.research === "Working" || pipelineState.research === "Completed";
    const reviewActive = pipelineState.review === "Working" || pipelineState.review === "Completed";

    return (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-white mb-2">Agent Architecture</h2>
                <p className="text-sm text-gray-400">Click any agent to view its Agent Card</p>
            </div>

            <div className="flex items-center justify-center gap-2 overflow-x-auto py-6 px-4">
                <motion.div
                    className="w-20 h-20 rounded-full border-2 border-gray-600 flex items-center justify-center bg-gray-800/50"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                >
                    <Bot size={24} className="text-gray-400" />
                </motion.div>

                <ConnectionLine isActive={triageActive} />
                <AgentNode agent="triage" status={pipelineState.triage} onClick={setSelectedAgent} isActive={selectedAgent === "triage"} />
                <ConnectionLine isActive={researchActive} />
                <AgentNode agent="research" status={pipelineState.research} onClick={setSelectedAgent} isActive={selectedAgent === "research"} />
                <ConnectionLine isActive={reviewActive} />
                <AgentNode agent="review" status={pipelineState.review} onClick={setSelectedAgent} isActive={selectedAgent === "review"} />
                <ConnectionLine isActive={pipelineState.presentation === "Working" || pipelineState.presentation === "Completed"} />
                <AgentNode agent="presentation" status={pipelineState.presentation} onClick={setSelectedAgent} isActive={selectedAgent === "presentation"} />
            </div>

            {/* Agent Card Panel */}
            {selectedAgent && (
                <AgentCardPanel
                    agent={selectedAgent}
                    agentCard={agentCards[selectedAgent]}
                    fallbackInfo={AGENT_INFO[selectedAgent]}
                />
            )}

            {/* Legend */}
            <div className="flex justify-center gap-6 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                    <span>Queued</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>Working</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>Completed</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span>Failed</span>
                </div>
            </div>

            {/* A2A Protocol Log */}
            <div className="mt-8 pt-6 border-t border-gray-700">
                <A2AMessageLog
                    messages={a2aMessages}
                    isVisible={true}
                    onToggle={() => { }} // Always visible in this view, or add local toggle if needed
                />
            </div>
        </div >
    );
}
