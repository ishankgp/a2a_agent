// ApprovalModal.jsx - Human-in-the-Loop approval checkpoint
import { motion } from "framer-motion";
import { CheckCircle, XCircle, Edit3, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { Button } from "./ui/button";

export default function ApprovalModal({ content, onApprove, onEdit, onReject }) {
    const [isEditing, setIsEditing] = useState(false);
    const [editedContent, setEditedContent] = useState(content);

    const handleApprove = () => {
        if (isEditing) {
            onEdit(editedContent);
        } else {
            onApprove();
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
        >
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-2xl"
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-700 bg-gradient-to-r from-amber-900/30 to-orange-900/30">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <AlertTriangle size={20} className="text-amber-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-white">Approval Required</h2>
                            <p className="text-sm text-gray-400">Review the content before proceeding to presentation</p>
                        </div>
                    </div>
                </div>

                {/* A2A State Badge */}
                <div className="px-6 py-2 bg-gray-800/50 border-b border-gray-700">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-900/50 border border-amber-700 text-xs text-amber-300">
                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                        A2A State: input-required
                    </span>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="mb-4">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-300">Reviewed Content</span>
                            <button
                                onClick={() => setIsEditing(!isEditing)}
                                className={`flex items-center gap-1 px-2 py-1 text-xs rounded transition-colors ${isEditing ? "bg-blue-900/50 text-blue-300" : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                <Edit3 size={12} />
                                {isEditing ? "Editing" : "Edit"}
                            </button>
                        </div>

                        {isEditing ? (
                            <textarea
                                value={editedContent}
                                onChange={(e) => setEditedContent(e.target.value)}
                                className="w-full h-48 p-4 bg-gray-950 border border-gray-700 rounded-lg text-sm text-gray-300 font-mono resize-none focus:outline-none focus:border-blue-500"
                            />
                        ) : (
                            <div className="p-4 bg-gray-950 border border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono">
                                    {content.length > 500 ? content.slice(0, 500) + "..." : content}
                                </pre>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="px-6 py-4 border-t border-gray-700 bg-gray-800/30 flex justify-end gap-3">
                    <Button
                        variant="outline"
                        onClick={onReject}
                        className="text-red-400 border-red-800 hover:bg-red-900/30"
                    >
                        <XCircle size={16} className="mr-2" />
                        Reject
                    </Button>
                    <Button
                        onClick={handleApprove}
                        className="bg-green-600 hover:bg-green-700 text-white"
                    >
                        <CheckCircle size={16} className="mr-2" />
                        {isEditing ? "Save & Approve" : "Approve & Continue"}
                    </Button>
                </div>
            </motion.div>
        </motion.div>
    );
}
