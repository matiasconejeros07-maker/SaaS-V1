-- Imágenes de productos y logos. Ruta: <store_id>/<archivo>.
-- Solo existe en Supabase (esquema storage); en Postgres puro se omite.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'storage') then
    raise notice 'Sin esquema storage: se omite la configuración de imágenes.';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do nothing;

  execute $p$
    create policy "Miembros suben imágenes de su tienda" on storage.objects for insert to authenticated
    with check (bucket_id = 'product-images' and public.is_member(((storage.foldername(name))[1])::uuid, array['owner','admin']::public.member_role[]))
  $p$;
  execute $p$
    create policy "Miembros borran imágenes de su tienda" on storage.objects for delete to authenticated
    using (bucket_id = 'product-images' and public.is_member(((storage.foldername(name))[1])::uuid, array['owner','admin']::public.member_role[]))
  $p$;
end $$;
