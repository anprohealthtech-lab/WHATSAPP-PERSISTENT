create table public.message_variations (
  id bigserial not null,
  campaign_id text not null,
  message text not null,
  original_message text not null,
  variation_number integer not null,
  created_at timestamp with time zone not null default now(),
  fixed_params jsonb null,
  constraint message_variations_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists message_variations_campaign_created_idx on public.message_variations using btree (campaign_id, created_at) TABLESPACE pg_default;


create table public.campaign_recipients (
  id bigserial not null,
  campaign_id text not null,
  name text not null,
  phone text not null,
  extra jsonb null,
  created_at timestamp with time zone not null default now(),
  constraint campaign_recipients_pkey primary key (id)
) TABLESPACE pg_default;

create index IF not exists campaign_recipients_campaign_idx on public.campaign_recipients using btree (campaign_id) TABLESPACE pg_default;