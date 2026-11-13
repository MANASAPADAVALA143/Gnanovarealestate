-- Ambhuja by Maytri: villa township at ORR Exit 11, Hyderabad (222 & 300 sq yd villas).
-- Requires 20261008000000_viseshta_avenues_workspace.sql (workspaces table + extra pipeline stages).

INSERT INTO public.workspaces (slug, name, is_default)
VALUES ('ambhuja-maytri', 'Ambhuja by Maytri', FALSE)
ON CONFLICT (slug) DO NOTHING;
