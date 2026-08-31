create or replace function public.is_couple_member(target_couple_id uuid)
returns boolean language sql stable security invoker as $$
select exists(select 1 from public.couple_members where couple_id=target_couple_id and user_id=auth.uid());
$$;

do $$ declare t text; begin
foreach t in array[
'profiles','privacy_settings','user_devices','couples','couple_members','conversations',
'messages','message_reactions','message_receipts','media','memories','memory_media',
'timeline_events','journal_entries','important_dates','surprises','calls','call_signals',
'game_sessions','game_answers','notification_preferences','blocks','reports','security_events'
] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

create policy profiles_self_insert on public.profiles for insert to authenticated with check(id=auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
create policy profiles_self_select on public.profiles for select to authenticated using(true);

create policy privacy_self on public.privacy_settings for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy devices_self on public.user_devices for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy couples_select on public.couples for select to authenticated using(partner_a=auth.uid() or partner_b=auth.uid());
create policy couples_insert on public.couples for insert to authenticated with check(partner_a=auth.uid());
create policy couples_update on public.couples for update to authenticated using(partner_a=auth.uid() or partner_b=auth.uid()) with check(partner_a=auth.uid() or partner_b=auth.uid());

create policy members_select on public.couple_members for select to authenticated using(public.is_couple_member(couple_id));
create policy members_insert_self on public.couple_members for insert to authenticated with check(user_id=auth.uid());

create policy conversations_select on public.conversations for select to authenticated using(public.is_couple_member(couple_id));
create policy conversations_insert on public.conversations for insert to authenticated with check(public.is_couple_member(couple_id));

create policy messages_select on public.messages for select to authenticated using(exists(select 1 from public.conversations c where c.id=conversation_id and public.is_couple_member(c.couple_id)));
create policy messages_insert on public.messages for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.conversations c where c.id=conversation_id and public.is_couple_member(c.couple_id)));
create policy messages_update_self on public.messages for update to authenticated using(sender_id=auth.uid()) with check(sender_id=auth.uid());
create policy messages_delete_self on public.messages for delete to authenticated using(sender_id=auth.uid());

create policy reactions_select on public.message_reactions for select to authenticated using(exists(select 1 from public.messages m join public.conversations c on c.id=m.conversation_id where m.id=message_id and public.is_couple_member(c.couple_id)));
create policy reactions_self on public.message_reactions for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy receipts_select on public.message_receipts for select to authenticated using(exists(select 1 from public.messages m join public.conversations c on c.id=m.conversation_id where m.id=message_id and public.is_couple_member(c.couple_id)));
create policy receipts_self on public.message_receipts for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());

create policy media_select on public.media for select to authenticated using(owner_id=auth.uid() or (couple_id is not null and public.is_couple_member(couple_id)));
create policy media_insert on public.media for insert to authenticated with check(owner_id=auth.uid());
create policy media_delete on public.media for delete to authenticated using(owner_id=auth.uid());

create policy memories_member on public.memories for all to authenticated using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id) and created_by=auth.uid());
create policy memory_media_select on public.memory_media for select to authenticated using(exists(select 1 from public.memories m where m.id=memory_id and public.is_couple_member(m.couple_id)));

create policy timeline_member on public.timeline_events for all to authenticated using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id) and created_by=auth.uid());
create policy journal_member on public.journal_entries for all to authenticated using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id) and created_by=auth.uid());
create policy dates_member on public.important_dates for all to authenticated using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id) and created_by=auth.uid());

create policy surprises_participant on public.surprises for select to authenticated using(sender_id=auth.uid() or recipient_id=auth.uid());
create policy surprises_insert on public.surprises for insert to authenticated with check(sender_id=auth.uid() and public.is_couple_member(couple_id));

create policy calls_participant on public.calls for select to authenticated using(caller_id=auth.uid() or receiver_id=auth.uid());
create policy calls_insert on public.calls for insert to authenticated with check(caller_id=auth.uid() and public.is_couple_member(couple_id));
create policy calls_update on public.calls for update to authenticated using(caller_id=auth.uid() or receiver_id=auth.uid()) with check(caller_id=auth.uid() or receiver_id=auth.uid());

create policy signals_select on public.call_signals for select to authenticated using(exists(select 1 from public.calls c where c.id=call_id and (c.caller_id=auth.uid() or c.receiver_id=auth.uid())));
create policy signals_insert on public.call_signals for insert to authenticated with check(sender_id=auth.uid() and exists(select 1 from public.calls c where c.id=call_id and (c.caller_id=auth.uid() or c.receiver_id=auth.uid())));

create policy games_member on public.game_sessions for all to authenticated using(public.is_couple_member(couple_id)) with check(public.is_couple_member(couple_id) and created_by=auth.uid());
create policy answers_select on public.game_answers for select to authenticated using(exists(select 1 from public.game_sessions g where g.id=session_id and public.is_couple_member(g.couple_id)));
create policy answers_insert on public.game_answers for insert to authenticated with check(user_id=auth.uid());

create policy notification_self on public.notification_preferences for all to authenticated using(user_id=auth.uid()) with check(user_id=auth.uid());
create policy blocks_self on public.blocks for all to authenticated using(blocker_id=auth.uid()) with check(blocker_id=auth.uid());
create policy reports_insert on public.reports for insert to authenticated with check(reporter_id=auth.uid());
create policy reports_select on public.reports for select to authenticated using(reporter_id=auth.uid());
create policy security_events_select on public.security_events for select to authenticated using(user_id=auth.uid());
