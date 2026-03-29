import { traverseNode } from './core/traverse.js';

try {
  figma.showUI(__html__, { width: 400, height: 620 });

  figma.ui.onmessage = (msg) => {
    try {
      if (msg.type === 'apply-tag') {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
          selection.forEach(node => {
            node.setPluginData("elementor-tag", "");
            node.setPluginData("elementor-tag", msg.tag);

            let newName = node.name.replace(/\[.*?\]\s*/g, '');
            node.name = `[${msg.tag.toUpperCase()}] ${newName}`;
          });
          figma.notify("Tag Aplicada: " + msg.tag.toUpperCase());
        } else {
          figma.notify("Selecione algo primeiro.");
        }
      }

      if (msg.type === 'apply-role') {
        const selection = figma.currentPage.selection;
        if (selection.length > 0) {
          selection.forEach(node => {
            node.setPluginData("elementor_role", msg.role);
            
            let newName = node.name.replace(/\[(?:title|description|icon|image)\]\s*/gi, '');
            
            let roleLabel = msg.role;
            if (msg.role === 'title_text') roleLabel = 'title';
            if (msg.role === 'description_text') roleLabel = 'description';
              
            node.name = `[${roleLabel}] ${newName}`;
          });
          figma.notify("Sub-Tag Aplicada: " + msg.role);
        } else {
          figma.notify("Selecione um elemento interno primeiro.");
        }
      }

      if (msg.type === "export-json") {
        const selection = figma.currentPage.selection;
        if (selection.length === 0) { figma.notify("Selecione o Frame Principal."); return; }
        if (selection.length > 1) { figma.notify("🚨 Selecione apenas UM frame raiz. Use [PAGE-WRAPPER] com Auto Layout se necessário.", { error: true }); return; }

        figma.notify("⏳ Calculando árvore...");

        (async () => {
          try {
            const { colorMap, typoMap } = msg;
            let structure = await traverseNode(selection[0], true, { colorMap, typoMap });
            let content = Array.isArray(structure) ? structure : [structure];

            function sanitizeOutput(nodes) {
              if (!nodes || !Array.isArray(nodes)) return;
              nodes.forEach(node => {
                if (node && node.settings) {
                  delete node.settings._position;
                  delete node.settings.position;
                  delete node.settings.margin;
                  delete node.settings._margin;
                  delete node.settings.custom_css;
                  delete node.settings._offset_x;
                  delete node.settings._offset_y;
                  delete node.settings._z_index;
                  delete node.settings.offset_x;
                  delete node.settings.offset_y;
                }
                if (node && node.elements) {
                  sanitizeOutput(node.elements);
                }
              });
            }

            sanitizeOutput(content);

            const elementorJSON = {
              version: "0.4",
              title: "Export V19 Soltos Fix - " + selection[0].name,
              type: "container",
              content: content
            };

            figma.ui.postMessage({ type: "json-generated", data: JSON.stringify(elementorJSON, null, 2) });
            figma.notify("✅ JSON Gerado com Sucesso!");
          } catch (err) {
            figma.notify("Erro na exportação: " + err.message);
            console.error(err);
          }
        })();
      }

      // ─── C1: Handler export-images ────────────────────────────────
      if (msg.type === 'export-images') {
        (async () => {
          try {
            const selection = figma.currentPage.selection;

            // ─── C2: Guard — empty selection ──────────────────────
            if (selection.length === 0) {
              figma.notify('⚠️ Selecione um frame ou imagem primeiro.', { error: true });
              figma.ui.postMessage({ type: 'images-export-error' });
              return;
            }

            // ─── C3: Recursive image node collector ───────────────
            const LAYOUT_TAGS = new Set(['container', 'container-full', 'page-wrapper', 'image-box', 'icon-box', 'icon-list']);
            const IMAGE_TAGS  = new Set(['image', 'image-carousel', 'image-background']);

            function hasImageFill(node) {
              if (!('fills' in node) || node.fills === figma.mixed) return false;
              return Array.isArray(node.fills) && node.fills.some(f => f.type === 'IMAGE');
            }

            function collectImageNodes(node) {
              const results = [];
              const tag = node.getPluginData('elementor-tag');

              // Priority 1: node explicitly tagged as an image variant
              if (IMAGE_TAGS.has(tag)) {
                results.push(node);
                return results;
              }

              // Priority 2: image-box — grab the child with role 'image'
              if (tag === 'image-box' && 'children' in node) {
                const roleChild = node.children.find(c => c.getPluginData('elementor_role') === 'image');
                if (roleChild) {
                  results.push(roleChild);
                  return results;
                }
              }

              // Priority 3: any node with IMAGE fill that isn't a layout container
              if (!LAYOUT_TAGS.has(tag) && hasImageFill(node)) {
                results.push(node);
                return results;
              }

              // Priority 4: Figma native Slice — exportAsync renders everything within bounds
              // Note: a Slice tagged as 'image' is already caught by Priority 1 above.
              // This covers untagged Slices dropped directly into a frame.
              if (node.type === 'SLICE') {
                results.push(node);
                return results; // Slices have no exportable children; stop recursion
              }

              // Recurse into children
              if ('children' in node) {
                for (const child of node.children) {
                  results.push(...collectImageNodes(child));
                }
              }

              return results;
            }

            let imageNodes = [];
            for (const root of selection) {
              imageNodes.push(...collectImageNodes(root));
            }
            // Deduplicate by node id
            const seen = new Set();
            imageNodes = imageNodes.filter(n => {
              if (seen.has(n.id)) return false;
              seen.add(n.id);
              return true;
            });

            if (imageNodes.length === 0) {
              figma.notify('⚠️ Nenhuma imagem encontrada na seleção.', { error: true });
              figma.ui.postMessage({ type: 'images-export-error' });
              return;
            }

            // ─── C4: Export settings ───────────────────────────────
            const scale      = msg.scale || 1;
            const quality    = msg.quality != null ? msg.quality : 0.85;
            const qualityPct = Math.round(quality * 100);
            const scaleSuffix = scale > 1 ? `@${scale}x` : '';

            // ─── C6: Progress notification ─────────────────────────
            figma.notify(`⏳ Exportando ${imageNodes.length} imagem(ns) em WebP (${scale}x, qualidade: ${qualityPct}%)...`);

            // ─── C3 + C4 + C5: Export loop ────────────────────────
            const exported = [];
            for (const node of imageNodes) {
              // C5: Sanitize filename + scale suffix
              const safeName = (node.name
                .replace(/\[.*?\]/g, '')
                .replace(/[^a-zA-Z0-9à-öø-ÿ\s\-_]/g, '')
                .trim()
                .replace(/\s+/g, '-')
                .replace(/-+/g, '-')
                .toLowerCase()
                .slice(0, 200)
                || `image-${node.id}`) + scaleSuffix;

              // C4: exportAsync PNG with scale + useAbsoluteBounds (same as WebP Generator)
              const bytes = await node.exportAsync({
                format: 'PNG',
                useAbsoluteBounds: true,
                constraint: { type: 'SCALE', value: scale }
              });

              exported.push({ name: `${safeName}.webp`, bytes: Array.from(bytes) });
            }

            // ─── C6: Completion notification ───────────────────────
            figma.notify(`✅ ${exported.length} imagem(ns) prontas para download!`);

            // ─── C7: Send results to UI ────────────────────────────
            figma.ui.postMessage({ type: 'images-exported', images: exported, quality });

          } catch (err) {
            // ─── C8: Error handling ────────────────────────────────
            figma.notify('⚠️ Erro ao exportar imagens: ' + err.message, { error: true });
            console.error('[export-images]', err);
            figma.ui.postMessage({ type: 'images-export-error' });
          }
        })();
      }
    } catch (e) {
      figma.notify("Erro Msg: " + e.message);
      console.error(e);
    }
  };
} catch (globalError) {
  console.error(globalError);
  figma.notify("Erro Fatal: " + globalError.message, { error: true });
}
