-- More chat reactions: fifteen emoji instead of six. The keys are mapped to emoji in the app
-- (REACTION_EMOJI in src/components/message-reactions.tsx) and must match ReactionKey in src/lib/api.ts.
-- Run in the Supabase SQL editor after 012, before shipping the app update that offers them.
-- Safe for older builds: they only ever send the original six.

begin;

alter table public.message_reactions drop constraint message_reactions_emoji_check;
alter table public.message_reactions add constraint message_reactions_emoji_check check (
  emoji in (
    'like', 'love', 'laugh', 'fire', 'shoe', 'wow',
    'clap', 'party', 'strong', 'trophy', 'hundred', 'sad', 'angry', 'eyes', 'thanks'
  )
);

commit;
