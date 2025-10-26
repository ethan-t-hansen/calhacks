import { neon, NeonQueryFunction } from "@neondatabase/serverless";
import { DocumentState } from "../document/types";

let neon_instance: NeonQueryFunction<false, false> | null = null;

export function getNeonDb(): NeonQueryFunction<false, false> {
    if (!neon_instance) {
        neon_instance = neon(process.env.DATABASE_URL || "");
    }
    return neon_instance;
}

export const neonDAO = {
    async query<T = any>(fn: (sql: NeonQueryFunction<false, false>) => Promise<T[]>): Promise<T[]> {
        const db = getNeonDb();
        return fn(db);
    },
    async one<T = any>(fn: (sql: NeonQueryFunction<false, false>) => Promise<T[]>): Promise<T | null> {
        const db = getNeonDb();
        const res = await fn(db);
        return res.length === 0 ? null : (res[0] ?? null);
    },
    async many<T = any>(fn: (sql: NeonQueryFunction<false, false>) => Promise<T[]>): Promise<T[]> {
        const db = getNeonDb();
        return fn(db);
    },
    async persistDocument(document: DocumentState) {
        const db = getNeonDb();
        const { yjs_state } = document;
        await db`
            INSERT INTO yjs_document_states (document_id, state_vector, update_data, timestamp)
            VALUES (${yjs_state.document_id}, ${yjs_state.state_vector}, ${yjs_state.update}, to_timestamp(${yjs_state.timestamp}::double precision / 1000.0))
            ON CONFLICT (document_id)
            DO UPDATE SET
                state_vector = EXCLUDED.state_vector,
                update_data = EXCLUDED.update_data,
                timestamp = EXCLUDED.timestamp
        `;
    }
};
