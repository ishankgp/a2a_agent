// A2AMessageLog.jsx - Live A2A protocol message viewer
import { motion, AnimatePresence } from "framer-motion";
import { Copy, ChevronDown, ChevronUp, ArrowRight, ArrowLeft, Radio } from "lucide-react";
import { useState } from "react";

const AGENT_COLORS = {
    triage: { bg: "bg-purple-900/30", border: "border-purple-700", text: "text-purple-300" },
    research: { bg: "bg-blue-900/30", border: "border-blue-700", text: "text-blue-300" },
    review: { bg: "bg-green-900/30", border: "border-green-700", text: "text-green-300" },
    presentation: { bg: "bg-amber-900/30", border: "border-amber-700", text: "text-amber-300" },
};

const TYPE_ICONS = {
    request: { icon: ArrowRight, label: "REQUEST", color: "text-cyan-400" },
    response: { icon: ArrowLeft, label: "RESPONSE", color: "text-lime-400" },
    stream: { icon: Radio, label: "STREAM", color: "text-yellow-400" },
};

function MessageEntry({ message }) {
    const [expanded, setExpanded] = useState(false);
    const agentColors = AGENT_COLORS[message.agent] || AGENT_COLORS.triage;
    const typeInfo = TYPE_ICONS[message.type] || TYPE_ICONS.request;
    const Icon = typeInfo.icon;

    const copyToClipboard = () => {
        navigator.clipboard.writeText(JSON.stringify(message.data, null, 2));
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${agentColors.bg} ${agentColors.border} border rounded-lg p-3 mb-2`}
        >
            <div className="flex items-center gap-2 text-xs">
                <span className="text-gray-500 font-mono">{message.timestamp}</span>
                <Icon size={14} className={typeInfo.color} />
                <span className={`font-semibold uppercase ${agentColors.text}`}>
                    {message.agent}
                </span>
                <span className={`${typeInfo.color} font-medium`}>{typeInfo.label}</span>
                <div className="flex-1" />
                <button
                    onClick={copyToClipboard}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title="Copy JSON"
                >
                    <Copy size={12} className="text-gray-400" />
                </button>
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                >
                    {expanded ? (
                        <ChevronUp size={12} className="text-gray-400" />
                    ) : (
                        <ChevronDown size={12} className="text-gray-400" />
                    )}
                </button>
            </div>

            {/* Preview */}
            <div className="mt-2 text-xs text-gray-300 truncate">
                {message.preview}
            </div>

            {/* Expanded JSON */}
            <AnimatePresence>
                {expanded && (
                    <motion.pre
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="mt-2 p-2 bg-gray-950 rounded text-[10px] text-green-400 font-mono overflow-x-auto"
                    >
                        {JSON.stringify(message.data, null, 2)}
                    </motion.pre>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default function A2AMessageLog({ messages, isVisible, onToggle }) {
    if (!isVisible) return null;

    return (
        <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-gray-900/80 border border-gray-700 rounded-xl overflow-hidden"
        >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-800/50">
                <div className="flex items-center gap-2">
                    <Radio size={16} className="text-cyan-400" />
                    <span className="font-semibold text-white text-sm">A2A Protocol Log</span>
                    <span className="text-xs text-gray-400">({messages.length} messages)</span>
                </div>
                <button
                    onClick={onToggle}
                    className="text-xs text-gray-400 hover:text-white transition-colors"
                >
                    Hide
                </button>
            </div>

            <div className="p-3 max-h-80 overflow-y-auto">
                {messages.length === 0 ? (
                    <div className="text-center text-gray-500 text-sm py-4">
                        No A2A messages yet. Start a pipeline run to see protocol traffic.
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <MessageEntry key={idx} message={msg} />
                    ))
                )}
            </div>
        </motion.div>
    );
}
