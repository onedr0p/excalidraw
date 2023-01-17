import {
  exportToCanvas,
  ExportToCanvasConfig,
  ExportToCanvasData,
  exportToSvg as _exportToSvg,
} from "../scene/export";
import { getDefaultAppState } from "../appState";
import { getNonDeletedElements } from "../element";
import { restore } from "../data/restore";
import { DEFAULT_BACKGROUND_COLOR, MIME_TYPES } from "../constants";
import { encodePngMetadata } from "../data/image";
import { serializeAsJSON } from "../data/json";
import {
  copyBlobToClipboardAsPng,
  copyTextToSystemClipboard,
  copyToClipboard,
} from "../clipboard";

export { MIME_TYPES };

type ExportToBlobConfig = ExportToCanvasConfig & {
  mimeType?: string;
  quality?: number;
};

type ExportToSvgConfig = Pick<
  ExportToCanvasConfig,
  "canvasBackgroundColor" | "padding" | "theme"
>;

export const exportToBlob = async ({
  data,
  config,
}: {
  data: ExportToCanvasData;
  config?: ExportToBlobConfig;
}): Promise<Blob> => {
  let { mimeType = MIME_TYPES.png, quality } = config || {};

  if (mimeType === MIME_TYPES.png && typeof quality === "number") {
    console.warn(`"quality" will be ignored for "${MIME_TYPES.png}" mimeType`);
  }

  // typo in MIME type (should be "jpeg")
  if (mimeType === "image/jpg") {
    mimeType = MIME_TYPES.jpg;
  }

  if (mimeType === MIME_TYPES.jpg && !config?.canvasBackgroundColor === false) {
    console.warn(
      `Defaulting "exportBackground" to "true" for "${MIME_TYPES.jpg}" mimeType`,
    );
    config = {
      ...config,
      canvasBackgroundColor:
        data.appState?.viewBackgroundColor || DEFAULT_BACKGROUND_COLOR,
    };
  }

  const canvas = await exportToCanvas({
    data,
    config,
  });

  quality = quality ? quality : /image\/jpe?g/.test(mimeType) ? 0.92 : 0.8;

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          return reject(new Error("couldn't export to blob"));
        }
        if (
          blob &&
          mimeType === MIME_TYPES.png &&
          data.appState?.exportEmbedScene
        ) {
          blob = await encodePngMetadata({
            blob,
            metadata: serializeAsJSON(
              data.elements,
              data.appState,
              data.files || {},
              "local",
            ),
          });
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
};

export const exportToSvg = async ({
  data,
  config,
}: {
  data: ExportToCanvasData;
  config?: ExportToSvgConfig;
}): Promise<SVGSVGElement> => {
  const { elements: restoredElements, appState: restoredAppState } = restore(
    { ...data, files: data.files || {} },
    null,
    null,
  );
  return _exportToSvg(
    getNonDeletedElements(restoredElements),
    { ...restoredAppState, exportPadding: config?.padding },
    data.files || {},
  );
};

export const exportToClipboard = async ({
  type,
  data,
  config,
}: {
  data: ExportToCanvasData;
} & (
  | { type: "png"; config?: ExportToBlobConfig }
  | { type: "svg"; config?: ExportToSvgConfig }
  | { type: "json"; config?: never }
)) => {
  if (type === "svg") {
    const svg = await exportToSvg({ data, config });
    await copyTextToSystemClipboard(svg.outerHTML);
  } else if (type === "png") {
    await copyBlobToClipboardAsPng(exportToBlob({ data, config }));
  } else if (type === "json") {
    const appState = {
      offsetTop: 0,
      offsetLeft: 0,
      width: 0,
      height: 0,
      ...getDefaultAppState(),
      ...data.appState,
    };
    await copyToClipboard(data.elements, appState, data.files);
  } else {
    throw new Error("Invalid export type");
  }
};

export { serializeAsJSON, serializeLibraryAsJSON } from "../data/json";
export {
  loadFromBlob,
  loadSceneOrLibraryFromBlob,
  loadLibraryFromBlob,
} from "../data/blob";
export { getFreeDrawSvgPath } from "../renderer/renderElement";
export { mergeLibraryItems } from "../data/library";
