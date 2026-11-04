const EXCERPT_LENGTH = 500;

export function excerpt(text: string): string {
    const trimmedText = text.trim();
    if (trimmedText.length <= EXCERPT_LENGTH) return trimmedText;

    return `${trimmedText.slice(0, EXCERPT_LENGTH)}…`;
}

export class ClaudeError extends Error {
    constructor(message: string, options?: ErrorOptions) {
        super(message, options);
        this.name = new.target.name;
    }
}

export class ClaudeFailedError extends ClaudeError {}

export class ClaudeTimedOutError extends ClaudeError {}

export class ClaudeCancelledError extends ClaudeError {}

export class InvalidClaudeRequestError extends ClaudeError {}
