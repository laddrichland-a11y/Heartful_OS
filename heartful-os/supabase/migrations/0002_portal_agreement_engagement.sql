alter table clients
  add column if not exists portal_agreements_opened_at timestamptz;
