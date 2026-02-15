export default function TypingIndicator(){
    return (
        <div className="inline-flex items-center gap-1 px-3 py-2 rounded-2xl bg-neutral-800 text-neutral-200">
            <span className="sr-only">Assistant is thinking</span>
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
        </div>
    );
}