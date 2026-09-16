import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

/** Read-only previews: hover or keyboard focus; touch keeps the explicit detail dialog. */
export function useCardTooltip(identity: string | null, content: ReactNode, className = '') {
    const id = useId(), anchor = useRef<HTMLButtonElement>(null), popup = useRef<HTMLDivElement>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [open, setOpen] = useState(false), [position, setPosition] = useState<{ left: number; top: number } | null>(null);
    function clearTimer() { if (timer.current !== null) clearTimeout(timer.current); }
    function hide() { clearTimer(); setOpen(false); }
    function show() {
        clearTimer();
        if (!identity) return;
        timer.current = setTimeout(() => { window.dispatchEvent(new Event('duel-tooltip-open')); setPosition(null); setOpen(true); }, 220);
    }
    function leave() { clearTimer(); timer.current = setTimeout(() => setOpen(false), 160); }
    useEffect(() => { setOpen(false); return () => { if (timer.current !== null) clearTimeout(timer.current); }; }, [identity]);
    useLayoutEffect(() => {
        if (!open || !identity || !anchor.current || !popup.current) return;
        const place = () => {
            if (!anchor.current || !popup.current) return;
            const a = anchor.current.getBoundingClientRect(), box = popup.current.getBoundingClientRect(), gap = 12;
            const left = a.right + box.width + gap * 2 <= window.innerWidth ? a.right + gap
                : a.left - box.width - gap >= gap ? a.left - box.width - gap
                : Math.max(gap, Math.min(a.left, window.innerWidth - box.width - gap));
            const top = Math.max(gap, Math.min(a.top, window.innerHeight - box.height - gap));
            setPosition(old => old?.left === left && old.top === top ? old : { left, top });
        };
        place();
        const resize = new ResizeObserver(place);
        resize.observe(popup.current);
        const dismiss = () => setOpen(false);
        const keydown = (event: KeyboardEvent) => { if (event.key === 'Escape') dismiss(); };
        const scroll = (event: Event) => { if (!(event.target instanceof Node) || !popup.current?.contains(event.target)) dismiss(); };
        window.addEventListener('keydown', keydown);
        window.addEventListener('scroll', scroll, true);
        window.addEventListener('resize', dismiss);
        window.addEventListener('duel-tooltip-open', dismiss);
        return () => {
            resize.disconnect();
            window.removeEventListener('keydown', keydown);
            window.removeEventListener('scroll', scroll, true);
            window.removeEventListener('resize', dismiss);
            window.removeEventListener('duel-tooltip-open', dismiss);
        };
    }, [open, identity]);
    return {
        hide,
        trigger: {
            ref: anchor,
            'aria-describedby': open && identity ? id : undefined,
            onPointerEnter: (e: PointerEvent<HTMLButtonElement>) => { if (e.pointerType === 'mouse') show(); },
            onPointerLeave: leave,
            onFocus: (e: FocusEvent<HTMLButtonElement>) => { if (e.currentTarget.matches(':focus-visible')) show(); },
            onBlur: hide,
            onKeyDown: (e: ReactKeyboardEvent<HTMLButtonElement>) => { if (e.key === 'Escape') hide(); },
        },
        tooltip: open && identity && createPortal(<div ref={popup} id={id} role="tooltip" className={`du-wonder-tooltip ${className}`}
            style={{ left: position?.left ?? 0, top: position?.top ?? 0, visibility: position ? 'visible' : 'hidden' }}
            onPointerEnter={clearTimer} onPointerLeave={leave}>{content}</div>, document.body),
    };
}
