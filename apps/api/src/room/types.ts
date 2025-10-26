import { DocumentState } from "../document/types";

export type Room = {
    documents: { [key: string]: DocumentState };
};
