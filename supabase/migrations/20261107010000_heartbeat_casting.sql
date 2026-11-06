-- Record when a video is playing on a TV (AirPlay / Chromecast), so a family
-- watching on the big screen with the phone locked is still counted, and every
-- such session stays auditable.
alter table public.playback_heartbeats
  add column if not exists casting boolean not null default false;

comment on column public.playback_heartbeats.casting is
  'Player reported the video is playing on an external screen (AirPlay / Chromecast).';
