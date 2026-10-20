import React, { useEffect, useRef, useState } from 'react';
import { Camera, X, ImageOff } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { MAX_PHOTOS, shrinkImage, blobToDataUrl } from '../utils/images';

// Full-screen view of one photo; tap anywhere (or the X) to close
const Lightbox = ({ src, onClose }) => (
  <div className="photo-lightbox" onClick={onClose} role="dialog" aria-label="Photo">
    <button type="button" className="photo-lightbox-close" onClick={onClose} aria-label="Close photo">
      <X size={22} />
    </button>
    <img src={src} alt="Full size" onClick={(e) => e.stopPropagation()} />
  </div>
);

/*
 * Photos on a service request.
 *  - PhotoPicker:   choose / take photos while filling in the request form (optional).
 *  - RequestPhotos: thumbnails of the photos already on a request; tap one to see it full screen.
 */

export const PhotoPicker = ({ photos, onChange }) => {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [viewing, setViewing] = useState(null); // index of the picked photo shown full screen

  const handleFiles = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ''; // allow choosing the same photo again
    if (files.length === 0) return;
    setError('');
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) setError(`You can add up to ${MAX_PHOTOS} photos.`);

    setBusy(true);
    const added = [];
    for (const file of files.slice(0, room)) {
      try {
        const blob = await shrinkImage(file);
        // data: URL (not blob:) so the preview shows on every page setup
        added.push({ blob, url: await blobToDataUrl(blob) });
      } catch (err) {
        setError(err.message || 'Could not read that photo.');
      }
    }
    setBusy(false);
    if (added.length) onChange([...photos, ...added]);
  };

  const remove = (index) => {
    setViewing(null);
    onChange(photos.filter((_, i) => i !== index));
  };

  return (
    <div className="form-group">
      <label className="form-label">Photos <span className="text-muted" style={{ fontWeight: 400 }}>(optional)</span></label>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
        A picture of the problem helps the engineer prepare. You can skip this and send the request without photos.
      </div>

      <div className="photo-grid">
        {photos.map((p, i) => (
          <div key={p.url} className="photo-thumb">
            <button type="button" className="photo-open" onClick={() => setViewing(i)} aria-label={`View photo ${i + 1}`}>
              <img src={p.url} alt={`Attached photo ${i + 1}`} />
            </button>
            <button type="button" className="photo-remove" onClick={() => remove(i)} aria-label={`Remove photo ${i + 1}`}>
              <X size={14} />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS && (
          <button type="button" className="photo-add" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Camera size={22} />
            <span>{busy ? 'Preparing…' : 'Add photo'}</span>
          </button>
        )}
      </div>

      <input ref={inputRef} type="file" accept="image/*" multiple onChange={handleFiles} style={{ display: 'none' }} />
      {photos.length > 0 && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '6px' }}>Tap a photo to view it.</div>}
      {error && <div style={{ color: '#fca5a5', fontSize: '0.8rem', marginTop: '6px' }}>{error}</div>}
      {viewing !== null && photos[viewing] && <Lightbox src={photos[viewing].url} onClose={() => setViewing(null)} />}
    </div>
  );
};

export const RequestPhotos = ({ request }) => {
  const { fetchRequestPhoto } = useApp();
  const ids = (request.photos || []).map((p) => p.photoId);
  const idKey = ids.join(',');
  const [urls, setUrls] = useState({}); // photoId -> blob url, or null when it could not be loaded
  const [open, setOpen] = useState(null); // photoId shown full screen

  useEffect(() => {
    let cancelled = false;
    const made = [];
    (async () => {
      const next = {};
      for (const id of ids) {
        const url = await fetchRequestPhoto(request.id, id);
        if (url) made.push(url);
        next[id] = url;
      }
      if (!cancelled) setUrls(next);
    })();
    return () => { cancelled = true; made.forEach((u) => URL.revokeObjectURL(u)); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id, idKey, fetchRequestPhoto]);

  if (ids.length === 0) return null;

  return (
    <>
      <div className="photo-grid">
        {ids.map((id, i) => (
          urls[id] === null
            ? <div key={id} className="photo-thumb photo-missing" title="This photo could not be loaded"><ImageOff size={20} /></div>
            : urls[id]
              ? (
                <button key={id} type="button" className="photo-thumb" onClick={() => setOpen(id)} aria-label={`Open photo ${i + 1}`}>
                  <img src={urls[id]} alt={`Photo ${i + 1} for ${request.id}`} />
                </button>
              )
              : <div key={id} className="photo-thumb photo-loading" />
        ))}
      </div>

      {open && urls[open] && <Lightbox src={urls[open]} onClose={() => setOpen(null)} />}
    </>
  );
};
