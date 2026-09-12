CREATE POLICY "public upload listing request media"
ON storage.objects FOR INSERT TO anon
WITH CHECK (
  bucket_id = 'listing-request-media'
  AND (storage.foldername(name))[1] = 'public'
  AND lower(storage.extension(name)) IN ('jpg','jpeg','png','webp')
);

CREATE POLICY "staff read listing request media"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'listing-request-media'
  AND public.has_perm(auth.uid(), 'requests', 'view')
);

CREATE POLICY "staff delete listing request media"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'listing-request-media'
  AND public.has_perm(auth.uid(), 'requests', 'edit')
);