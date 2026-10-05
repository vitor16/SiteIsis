/*
 * Isis Avelar Nail Simulator — shared backend client
 *
 * 1. Create a Supabase project.
 * 2. Put your project URL and Publishable key below.
 * 3. Run supabase_schema.sql in Supabase SQL Editor.
 * 4. Create your owner account in Supabase Auth and add its user UUID to nail_admins.
 */

window.NAIL_BACKEND_CONFIG = window.NAIL_BACKEND_CONFIG || {
  SUPABASE_URL: 'https://efpeuzblgmbyxyfmcijl.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_Bsi1qsNvQ07GZ0dvJlvh6w_T5FGFDtd'
};

(function () {
  'use strict';

  const config = window.NAIL_BACKEND_CONFIG;

  const ready =
    config &&
    /^https:\/\/[^/]+\.supabase\.co$/.test(config.SUPABASE_URL) &&
    !!config.SUPABASE_PUBLISHABLE_KEY &&
    !config.SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
    !config.SUPABASE_PUBLISHABLE_KEY.includes('YOUR_');

  let client = null;

  if (window.supabase && ready) {
    client = window.supabase.createClient(
      config.SUPABASE_URL,
      config.SUPABASE_PUBLISHABLE_KEY,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true
        }
      }
    );
  }

  function localFallback(message) {
    console.warn('[NailBackend]', message);
  }

  function normalizePalette(rows) {
    return (Array.isArray(rows) ? rows : [])
      .filter(
        p =>
          p &&
          p.name &&
          /^#[0-9a-fA-F]{6}$/.test(String(p.hex))
      )
      .map((p, index) => ({
        id: p.id || null,
        name: String(p.name).trim(),
        hex: String(p.hex).toLowerCase(),
        enabled: p.enabled !== false,
        sort_order: Number.isFinite(Number(p.sort_order))
          ? Number(p.sort_order)
          : index
      }))
      .filter(p => p.name);
  }

  /*
   * PUBLIC SITE
   * Gets only enabled nail colors.
   */
  async function getPublicPalette(fallback) {
    if (!client) {
      localFallback(
        'Supabase is not configured; using the local/default palette.'
      );
      return fallback || [];
    }

    try {
      const { data, error } = await client
        .from('nail_palette')
        .select('id,name,hex,enabled,sort_order')
        .eq('enabled', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;

      const palette = normalizePalette(data);

      return palette.length ? palette : (fallback || []);
    } catch (error) {
      console.error(
        '[NailBackend] Failed to load public palette:',
        error
      );
      return fallback || [];
    }
  }

  /*
   * ADMIN LOGIN
   */
  async function signIn(email, password) {
    if (!client) {
      throw new Error(
        'Supabase ainda não foi configurado no nail-backend.js.'
      );
    }

    const cleanEmail = String(email || '').trim();
    const cleanPassword = String(password || '');

    if (!cleanEmail || !cleanPassword) {
      throw new Error('Informe seu e-mail e sua senha.');
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword
    });

    if (error) throw error;

    /*
     * Authentication succeeded, but we also verify that
     * this account is actually listed as a nail administrator.
     */
    const admin = await isAdmin();

    if (!admin) {
      await client.auth.signOut();
      throw new Error(
        'Esta conta não possui permissão de administrador.'
      );
    }

    return data;
  }

  /*
   * ADMIN LOGOUT
   */
  async function signOut() {
    if (!client) return;

    const { error } = await client.auth.signOut();

    if (error) throw error;
  }

  /*
   * CURRENT SESSION
   */
  async function getSession() {
    if (!client) return null;

    const { data, error } = await client.auth.getSession();

    if (error) throw error;

    return data?.session || null;
  }

  /*
   * CHECK ADMIN PERMISSION
   *
   * This calls the Supabase RPC function:
   * is_nail_admin()
   *
   * The database/RLS remains the actual security layer.
   */
  async function isAdmin() {
    if (!client) return false;

    const session = await getSession();

    if (!session) {
      return false;
    }

    const { data, error } = await client.rpc('is_nail_admin');

    if (error) throw error;

    return data === true;
  }

  /*
   * ADMIN PANEL
   * Gets all colors, including disabled ones.
   */
  async function getAdminPalette() {
    if (!client) {
      throw new Error(
        'Supabase ainda não foi configurado no nail-backend.js.'
      );
    }

    const admin = await isAdmin();

    if (!admin) {
      throw new Error(
        'Acesso negado. Esta conta não é administradora.'
      );
    }

    const { data, error } = await client
      .from('nail_palette')
      .select('id,name,hex,enabled,sort_order')
      .order('sort_order', { ascending: true });

    if (error) throw error;

    return normalizePalette(data);
  }

  /*
   * ADMIN PANEL
   * Saves the complete palette through the secure database RPC.
   */
  async function saveAdminPalette(items) {
    if (!client) {
      throw new Error(
        'Supabase ainda não foi configurado no nail-backend.js.'
      );
    }

    const admin = await isAdmin();

    if (!admin) {
      throw new Error(
        'Acesso negado. Esta conta não é administradora.'
      );
    }

    const clean = normalizePalette(items).map((p, index) => ({
      name: p.name,
      hex: p.hex,
      enabled: p.enabled !== false,
      sort_order: index
    }));

    if (!clean.length) {
      throw new Error(
        'Adicione pelo menos uma cor antes de salvar.'
      );
    }

    if (!clean.some(p => p.enabled)) {
      throw new Error(
        'Mantenha pelo menos uma cor disponível.'
      );
    }

    const { error } = await client.rpc(
      'save_nail_palette',
      {
        p_items: clean
      }
    );

    if (error) throw error;

    return getAdminPalette();
  }

  /*
   * EXPOSE PUBLIC API
   */
  window.NailBackend = {
    isConfigured: () => Boolean(client),
    getPublicPalette,
    signIn,
    signOut,
    getSession,
    isAdmin,
    getAdminPalette,
    saveAdminPalette
  };

  /*
   * Helpful console message while setting up the site.
   */
  if (client) {
    console.log(
      '[NailBackend] Supabase conectado:',
      config.SUPABASE_URL
    );
  } else {
    console.warn(
      '[NailBackend] Supabase não está configurado.'
    );
  }
})();