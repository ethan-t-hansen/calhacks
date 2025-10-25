import * as Y from "yjs";
import { StorageInterface, YjsUpdate, YjsDocumentState } from "./types";

export class YjsDocumentManager {
    private documents: Map<string, Y.Doc> = new Map();
    private storage: StorageInterface;
    private stateSnapshotInterval: NodeJS.Timeout | null = null;

    constructor(storage: StorageInterface) {
        this.storage = storage;
        this.startPeriodicSnapshots();
    }

    /**
     * Get or create a Y.Doc for a document
     */
    getDocument(documentId: string): Y.Doc {
        let doc = this.documents.get(documentId);
        if (!doc) {
            doc = new Y.Doc();
            this.documents.set(documentId, doc);

            // Set up update listener to persist changes
            doc.on("update", async (update: Uint8Array, origin: any) => {
                // Don't persist updates that came from the database (to avoid loops)
                if (origin === "database") return;

                try {
                    await this.storage.saveYjsUpdate({
                        type: "yjs_update",
                        document_id: documentId,
                        user_id: origin?.userId || "system",
                        update,
                        timestamp: new Date().toISOString()
                    });
                } catch (error) {
                    console.error("Failed to persist Yjs update:", error);
                }
            });

            // Load initial state from database
            this.loadDocumentState(documentId, doc);
        }
        return doc;
    }

    /**
     * Apply an update to a document
     */
    async applyUpdate(documentId: string, update: Uint8Array, userId: string): Promise<void> {
        const doc = this.getDocument(documentId);

        try {
            Y.applyUpdate(doc, update, { userId });
        } catch (error) {
            console.error("Failed to apply Yjs update:", error);
            throw error;
        }
    }

    /**
     * Get state vector for sync
     */
    getStateVector(documentId: string): Uint8Array {
        const doc = this.getDocument(documentId);
        return Y.encodeStateVector(doc);
    }

    /**
     * Get updates since a specific state vector
     */
    getUpdatesSince(documentId: string, stateVector: Uint8Array): Uint8Array {
        const doc = this.getDocument(documentId);
        return Y.encodeStateAsUpdate(doc, stateVector);
    }

    /**
     * Get all updates for a document
     */
    getAllUpdates(documentId: string): Uint8Array {
        const doc = this.getDocument(documentId);
        return Y.encodeStateAsUpdate(doc);
    }

    /**
     * Load document state from database
     */
    private async loadDocumentState(documentId: string, doc: Y.Doc): Promise<void> {
        try {
            const updates = await this.storage.getYjsUpdates(documentId);

            // Apply all updates in order
            for (const update of updates) {
                Y.applyUpdate(doc, update.update, "database");
            }
        } catch (error) {
            console.error("Failed to load document state:", error);
        }
    }

    /**
     * Create a snapshot of document state
     */
    async createSnapshot(documentId: string): Promise<void> {
        const doc = this.documents.get(documentId);
        if (!doc) return;

        try {
            const stateVector = Y.encodeStateVector(doc);
            const update = Y.encodeStateAsUpdate(doc);

            await this.storage.saveYjsDocumentState({
                type: "yjs_state",
                document_id: documentId,
                state_vector: stateVector,
                update,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error("Failed to create document snapshot:", error);
        }
    }

    /**
     * Start periodic snapshots every 5 minutes
     */
    private startPeriodicSnapshots(): void {
        this.stateSnapshotInterval = setInterval(
            async () => {
                for (const documentId of this.documents.keys()) {
                    await this.createSnapshot(documentId);
                }
            },
            5 * 60 * 1000
        ); // 5 minutes
    }

    /**
     * Stop periodic snapshots
     */
    stopPeriodicSnapshots(): void {
        if (this.stateSnapshotInterval) {
            clearInterval(this.stateSnapshotInterval);
            this.stateSnapshotInterval = null;
        }
    }

    /**
     * Clean up a document
     */
    destroyDocument(documentId: string): void {
        const doc = this.documents.get(documentId);
        if (doc) {
            doc.destroy();
            this.documents.delete(documentId);
        }
    }

    /**
     * Get document statistics
     */
    getStats(): { activeDocuments: number; documentIds: string[] } {
        return {
            activeDocuments: this.documents.size,
            documentIds: Array.from(this.documents.keys())
        };
    }
}
