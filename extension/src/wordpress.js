import { validateElementorDocument } from "./contract.js";

function normalizeRestRoot(value, origin) {
  const fallback = `${origin.replace(/\/$/, "")}/wp-json/`;
  if (!value || typeof value !== "string") return fallback;
  return value.endsWith("/") ? value : `${value}/`;
}

export function extractWordPressContext(probe = {}) {
  const origin = (() => {
    try {
      return new URL(probe.href || "").origin;
    } catch {
      return "";
    }
  })();

  return {
    tabId: probe.tabId || null,
    href: probe.href || "",
    title: probe.title || "",
    isWordPress: Boolean(probe.isWordPress),
    isElementor: Boolean(probe.isElementor),
    postId: probe.postId ? String(probe.postId) : null,
    nonce: typeof probe.nonce === "string" && probe.nonce ? probe.nonce : null,
    restRoot: normalizeRestRoot(probe.restRoot, origin),
    elementorNonce: typeof probe.elementorNonce === "string" && probe.elementorNonce ? probe.elementorNonce : null,
    elementorAjaxUrl: typeof probe.elementorAjaxUrl === "string" && probe.elementorAjaxUrl
      ? probe.elementorAjaxUrl
      : origin ? `${origin}/wp-admin/admin-ajax.php` : null,
    elementorVersion: probe.elementorVersion || null,
    postStatus: typeof probe.postStatus === "string" ? probe.postStatus : probe.postStatus?.value || null,
    postType: probe.postType || "page",
    postRestBase: probe.postRestBase || (probe.postType === "post" ? "posts" : "pages")
  };
}

export function validateWordPressContext(context, options = {}) {
  if (!context?.isWordPress) throw new Error("A aba ativa não parece ser um painel WordPress.");
  if (!context.nonce) throw new Error("Não foi possível encontrar o nonce REST do WordPress nesta aba.");
  if (options.requireElementor !== false) {
    if (!context.isElementor) throw new Error("A aba ativa não parece ser o editor Elementor.");
    if (!context.postId) throw new Error("Não foi possível identificar o post aberto no Elementor.");
    if (!context.elementorNonce || !context.elementorAjaxUrl) {
      throw new Error("Não foi possível encontrar o endpoint e o nonce de salvamento do Elementor.");
    }
  }
  return context;
}

export async function probeWordPressTab(tabId) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: () => {
      const parseAssignedText = (text, variableName) => {
        const markerIndex = text.indexOf(`${variableName} =`);
        if (markerIndex < 0) return null;
        const start = text.indexOf("{", markerIndex);
        if (start < 0) return null;
        let depth = 0;
        let quote = "";
        let escaped = false;
        for (let index = start; index < text.length; index += 1) {
          const character = text[index];
          if (quote) {
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === quote) quote = "";
            continue;
          }
          if (character === '"' || character === "'") {
            quote = character;
            continue;
          }
          if (character === "{") depth += 1;
          if (character === "}") {
            depth -= 1;
            if (depth === 0) {
              try {
                return JSON.parse(text.slice(start, index + 1));
              } catch {
                return null;
              }
            }
          }
        }
        return null;
      };
      const parseAssignedObject = (scriptId, variableName) => (
        parseAssignedText(document.getElementById(scriptId)?.textContent || "", variableName)
      );

      const common = window.elementorCommonConfig ||
        parseAssignedObject("elementor-common-js-before", "elementorCommonConfig") || {};
      const editor = window.ElementorConfig ||
        parseAssignedObject("elementor-editor-js-before", "ElementorConfig") || {};
      const wpApiScript = [...document.scripts]
        .map(script => script.textContent || "")
        .find(text => text.includes("wpApiSettings =")) || "";
      const parsedWpApi = window.wpApiSettings || parseAssignedText(wpApiScript, "wpApiSettings") || {};
      const initialDocument = editor.initial_document || editor.document || {};
      const postFromUrl = new URL(location.href).searchParams.get("post");
      const postType = initialDocument.post_type || String(initialDocument.type || "wp-page").replace(/^wp-/, "");
      const status = initialDocument.status?.value ||
        initialDocument.settings?.settings?.post_status ||
        initialDocument.settings?.controls?.post_status?.default || null;

      return {
        href: location.href,
        title: document.title,
        isWordPress: Boolean(
          parsedWpApi?.nonce ||
          document.body?.classList.contains("wp-admin") ||
          document.querySelector("#wpadminbar, #wpbody-content")
        ),
        isElementor: Boolean(
          initialDocument.id ||
          document.body?.classList.contains("elementor-editor-active") ||
          document.querySelector("#elementor-editor-wrapper")
        ),
        postId: initialDocument.id || postFromUrl || null,
        nonce: parsedWpApi?.nonce || document.querySelector('meta[name="wp-rest-nonce"]')?.content || null,
        restRoot: parsedWpApi?.root || `${location.origin}/wp-json/`,
        elementorNonce: common.ajax?.nonce || null,
        elementorAjaxUrl: common.ajax?.url || `${location.origin}/wp-admin/admin-ajax.php`,
        elementorVersion: common.version || initialDocument.version || null,
        postStatus: status,
        postType,
        postRestBase: postType === "post" ? "posts" : postType === "page" ? "pages" : postType
      };
    }
  });

  return extractWordPressContext({ ...(results[0]?.result || {}), tabId });
}

export function buildElementorSavePayload(document, existingElements = [], mode = "page", existingSettings = {}) {
  const schemaMode = document?.type === "page" ? "page" : "section";
  const validation = validateElementorDocument(document, schemaMode);
  if (!validation.valid) {
    throw new Error(`O documento não pode ser enviado ao Elementor:\n${validation.errors.join("\n")}`);
  }

  const incomingElements = Array.isArray(document?.content) ? document.content : [];
  const elements = mode === "section"
    ? [...(Array.isArray(existingElements) ? existingElements : []), ...incomingElements]
    : incomingElements;

  return {
    status: "draft",
    elements,
    settings: mode === "section"
      ? { ...(existingSettings || {}), ...(document?.page_settings || {}) }
      : { ...(document?.page_settings || {}) }
  };
}

export function buildElementorAjaxBody(context, requestId, action, data = {}) {
  validateWordPressContext(context);
  return new URLSearchParams({
    action: "elementor_ajax",
    editor_post_id: String(context.postId),
    _nonce: context.elementorNonce,
    actions: JSON.stringify({
      [requestId]: {
        action,
        data
      }
    })
  }).toString();
}

async function executeElementorAjax(tabId, context, requestId, action, data = {}) {
  const body = buildElementorAjaxBody(context, requestId, action, data);
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [{ url: context.elementorAjaxUrl, body }],
    func: async ({ url, body: requestBody }) => {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
        body: requestBody
      });
      const text = await response.text();
      let json;
      try { json = JSON.parse(text); } catch { json = null; }
      return { ok: response.ok, status: response.status, json, text: json ? "" : text.slice(0, 500) };
    }
  });

  const transport = results[0]?.result;
  if (!transport?.ok || !transport.json) {
    throw new Error(`O Elementor respondeu ${transport?.status || "sem status"}: ${transport?.text || "resposta inválida"}`);
  }
  if (transport.json.success !== true) {
    throw new Error(transport.json?.data?.message || "O endpoint do Elementor recusou a requisição.");
  }
  const actionResponse = transport.json?.data?.responses?.[requestId];
  if (!actionResponse || actionResponse.success !== true) {
    const detail = actionResponse?.data?.message || actionResponse?.data || actionResponse?.message || "A ação do Elementor falhou.";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return actionResponse.data;
}

function snapshotFromConfig(config = {}) {
  const document = config.document || config.config?.document || config;
  const elementEnvelope = document.elements || config.elements || [];
  const elements = Array.isArray(elementEnvelope) ? elementEnvelope : elementEnvelope?.data || [];
  const settingsEnvelope = document.settings || config.settings || {};
  const settings = settingsEnvelope?.settings || settingsEnvelope;
  const rawStatus = document.status || config.status || null;
  return {
    elements: Array.isArray(elements) ? elements : [],
    settings: settings && typeof settings === "object" ? settings : {},
    status: typeof rawStatus === "string" ? rawStatus : rawStatus?.value || null
  };
}

function collectElementIds(elements, result = []) {
  for (const element of elements || []) {
    if (element?.id) result.push(element.id);
    collectElementIds(element?.elements, result);
  }
  return result;
}

function collectMediaIds(value, result = []) {
  if (!value || typeof value !== "object") return result;
  if ((typeof value.id === "number" || /^\d+$/.test(String(value.id || ""))) && typeof value.url === "string" && value.url) {
    result.push(String(value.id));
  }
  for (const child of Object.values(value)) collectMediaIds(child, result);
  return result;
}

export function verifyElementorPersistence(snapshot, expectedElements) {
  const actualIds = new Set(collectElementIds(snapshot?.elements));
  const expectedIds = collectElementIds(expectedElements);
  const missingElementIds = expectedIds.filter(id => !actualIds.has(id));
  const actualMediaIds = new Set(collectMediaIds(snapshot?.elements));
  const expectedMediaIds = [...new Set(collectMediaIds(expectedElements))];
  const missingMediaIds = expectedMediaIds.filter(id => !actualMediaIds.has(id));
  return {
    persistent: missingElementIds.length === 0 && missingMediaIds.length === 0,
    elementCount: actualIds.size,
    expectedElementCount: expectedIds.length,
    missingElementIds,
    missingMediaIds
  };
}

export async function readElementorDocument(tabId, context) {
  const config = await executeElementorAjax(
    tabId,
    context,
    "figmentor_get_document",
    "get_document_config",
    { id: Number(context.postId) || context.postId }
  );
  return snapshotFromConfig(config);
}

export async function insertElementorDocument(tabId, context, document, mode = "page") {
  validateWordPressContext(context);
  const schemaMode = document?.type === "page" ? "page" : "section";
  const validation = validateElementorDocument(document, schemaMode);
  if (!validation.valid) {
    throw new Error(`O JSON final não pode ser enviado ao Elementor:\n${validation.errors.join("\n")}`);
  }

  const draftResult = await ensureWordPressDraft(tabId, context);
  context = { ...context, postStatus: draftResult.status };
  const before = await readElementorDocument(tabId, context);
  const payload = buildElementorSavePayload(document, before.elements, mode, before.settings);
  const saveResponse = await executeElementorAjax(
    tabId,
    context,
    "figmentor_save_builder",
    "save_builder",
    payload
  );
  const savedStatus = typeof saveResponse?.status === "string"
    ? saveResponse.status
    : saveResponse?.config?.document?.status?.value;
  if (savedStatus !== "draft") {
    throw new Error(`O servidor não confirmou o status draft (retornou ${savedStatus || "indefinido"}).`);
  }

  const after = await readElementorDocument(tabId, context);
  const verification = verifyElementorPersistence(after, payload.elements);
  if (!verification.persistent) {
    throw new Error(`O conteúdo não foi confirmado após o salvamento. IDs ausentes: ${verification.missingElementIds.join(", ") || "nenhum"}; mídias ausentes: ${verification.missingMediaIds.join(", ") || "nenhuma"}.`);
  }

  return {
    saved: true,
    verified: true,
    status: savedStatus,
    elementCount: payload.elements.length,
    expectedElements: payload.elements,
    verification,
    responseStatus: "ok"
  };
}

export async function ensureWordPressDraft(tabId, context) {
  validateWordPressContext(context);
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [{
      url: `${context.restRoot}wp/v2/${context.postRestBase}/${context.postId}`,
      nonce: context.nonce
    }],
    func: async ({ url, nonce }) => {
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-WP-Nonce": nonce,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: "draft" })
      });
      const body = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        httpStatus: response.status,
        status: body.status || null,
        code: body.code || null,
        message: body.message || null
      };
    }
  });
  const result = results[0]?.result;
  if (!result?.ok || result.status !== "draft") {
    throw new Error(result?.message || `O WordPress não confirmou a mudança para rascunho (HTTP ${result?.httpStatus || "indefinido"}, status ${result?.status || "indefinido"}).`);
  }
  return result;
}

export async function reloadAndVerifyElementorDocument(tabId, context, expectedElements, options = {}) {
  await chrome.tabs.reload(tabId);
  const timeoutMs = options.timeoutMs || 45000;
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const tab = await chrome.tabs.get(tabId);
    if (tab.status === "complete") break;
    await new Promise(resolve => setTimeout(resolve, 300));
  }
  const tab = await chrome.tabs.get(tabId);
  if (tab.status !== "complete") throw new Error("A aba do Elementor não terminou de recarregar para a verificação.");

  const refreshedContext = await probeWordPressTab(tabId);
  validateWordPressContext(refreshedContext);
  const snapshot = await readElementorDocument(tabId, refreshedContext);
  const verification = verifyElementorPersistence(snapshot, expectedElements);
  if (!verification.persistent) {
    throw new Error(`O conteúdo não persistiu após recarregar. IDs ausentes: ${verification.missingElementIds.join(", ") || "nenhum"}; mídias ausentes: ${verification.missingMediaIds.join(", ") || "nenhuma"}.`);
  }
  return { verified: true, context: refreshedContext, verification };
}

function arrayBufferToBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export async function uploadMediaToWordPress(tabId, context, blob, filename, mimeType) {
  validateWordPressContext(context, { requireElementor: false });
  const base64 = arrayBufferToBase64(await blob.arrayBuffer());

  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [{ restRoot: context.restRoot, nonce: context.nonce, filename, mimeType, base64 }],
    func: async ({ restRoot, nonce, filename: uploadName, mimeType: uploadType, base64: encoded }) => {
      const binary = atob(encoded);
      const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
      const response = await fetch(`${restRoot}wp/v2/media`, {
        method: "POST",
        credentials: "include",
        headers: {
          "X-WP-Nonce": nonce,
          "Content-Disposition": `attachment; filename=\"${uploadName.replace(/\"/g, "")}\"`,
          "Content-Type": uploadType
        },
        body: bytes
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body.code || !body.id) {
        const detail = body.message || body.code || `resposta sem ID (${Object.keys(body).join(", ") || "vazia"})`;
        throw new Error(`Upload recusado pelo WordPress: ${detail} [HTTP ${response.status}]`);
      }

      let mediaUrl = body.source_url || body.guid?.rendered || null;
      if (!mediaUrl) {
        const mediaResponse = await fetch(`${restRoot}wp/v2/media/${body.id}?context=edit`, {
          method: "GET",
          credentials: "include",
          headers: { "X-WP-Nonce": nonce }
        });
        const media = await mediaResponse.json().catch(() => ({}));
        mediaUrl = media.source_url || media.guid?.rendered || null;
      }

      return {
        id: body.id,
        source_url: mediaUrl,
        guid: { rendered: mediaUrl },
        mime_type: body.mime_type || uploadType,
        file: body.media_details?.file || uploadName,
        httpStatus: response.status
      };
    }
  });

  return results[0]?.result || null;
}
