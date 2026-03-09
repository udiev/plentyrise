# Skill: UI Redesign

When asked to redesign or improve the UI, follow this process:

## Design System (PlentyRise)
- Background: `#0A0F1E` (dark navy)
- Surface: `bg-slate-900` with `border border-slate-800`
- Cards: `rounded-2xl p-5`
- Primary: `blue-600` / `blue-500`
- Success: `green-400`, Error: `red-400`, Warning: `amber-400`
- Muted text: `text-slate-400`, `text-slate-500`
- Font: `font-mono` for numbers and data, `font-sans` for labels
- Sticky header: `sticky top-0 z-10 bg-[#0A0F1E]`

## Inspiration
Linear.app, Vercel Dashboard, Stripe Dashboard.
Dark, minimal, data-dense. No gradients. No shadows. Clean borders.

## Process
1. Start with the shared Layout component — header + nav must be consistent
2. Build reusable components before pages (StatCard, Table, Badge, EmptyState)
3. Apply to all pages: Dashboard, Investments, Crypto, RealEstate, Cash, Pension
4. Add micro-interactions: hover states, loading skeletons, smooth transitions
5. Make it responsive — mobile breakpoints last

## Component Patterns
```jsx
// Stat Card
<div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
  <p className="text-slate-500 text-xs uppercase tracking-wider mb-1">Label</p>
  <p className="text-2xl font-bold">$0</p>
  <p className="text-slate-500 text-xs mt-1">subtitle</p>
</div>

// Table row hover
<tr className="border-b border-slate-800/50 hover:bg-slate-800/30 transition">

// Primary button
<button className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-sm font-semibold transition">

// Empty state
<div className="text-center text-slate-600 py-16 border border-dashed border-slate-800 rounded-2xl">
```
