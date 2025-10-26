import * as Y from "yjs";
import { YjsUpdate, YjsDocumentState } from "../types";
import * as db from "./database.model";

const documents = new Map<string, Y.Doc>();
let snapshotInterval: NodeJS.Timeout | null = null;

export function getDocument(documentId: string): Y.Doc {
    let doc = documents.get(documentId);
    if (!doc) {
        doc = new Y.Doc();
        documents.set(documentId, doc);

        doc.on("update", async (update: Uint8Array, origin: any) => {
            if (origin === "database") return;

            try {
                await db.saveYjsUpdate({
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

        loadDocumentState(documentId, doc);
    }
    return doc;
}

export async function applyUpdate(documentId: string, update: Uint8Array, userId: string): Promise<void> {
    const doc = getDocument(documentId);

    try {
        Y.applyUpdate(doc, update, { userId });
    } catch (error) {
        console.error("Failed to apply Yjs update:", error);
        throw error;
    }
}

export function getStateVector(documentId: string): Uint8Array {
    const doc = getDocument(documentId);
    return Y.encodeStateVector(doc);
}

export function getUpdatesSince(documentId: string, stateVector: Uint8Array): Uint8Array {
    const doc = getDocument(documentId);
    return Y.encodeStateAsUpdate(doc, stateVector);
}

export function getAllUpdates(documentId: string): Uint8Array {
    const doc = getDocument(documentId);
    return Y.encodeStateAsUpdate(doc);
}

async function loadDocumentState(documentId: string, doc: Y.Doc): Promise<void> {
    try {
        const updates = await db.getYjsUpdates(documentId);

        for (const update of updates) {
            Y.applyUpdate(doc, update.update, "database");
        }
    } catch (error) {
        console.error("Failed to load document state:", error);
    }
}

export async function createSnapshot(documentId: string): Promise<void> {
    const doc = documents.get(documentId);
    if (!doc) return;

    try {
        const stateVector = Y.encodeStateVector(doc);
        const update = Y.encodeStateAsUpdate(doc);

        await db.saveYjsDocumentState({
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

export function startPeriodicSnapshots(): void {
    snapshotInterval = setInterval(
        async () => {
            for (const documentId of documents.keys()) {
                await createSnapshot(documentId);
            }
        },
        5 * 60 * 1000
    );
}

export function stopPeriodicSnapshots(): void {
    if (snapshotInterval) {
        clearInterval(snapshotInterval);
        snapshotInterval = null;
    }
}

export function destroyDocument(documentId: string): void {
    const doc = documents.get(documentId);
    if (doc) {
        doc.destroy();
        documents.delete(documentId);
    }
}

export function getStats(): { activeDocuments: number; documentIds: string[] } {
    return {
        activeDocuments: documents.size,
        documentIds: Array.from(documents.keys())
    };
}
