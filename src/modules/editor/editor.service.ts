import * as Y from 'yjs';
import { ArchivoProyecto } from '@prisma/client';
import { EditorRepository, UpdateProjectFilesData } from './editor.repository';

export class EditorService {
    private editorRepository: EditorRepository;

    constructor(editorRepository: EditorRepository = new EditorRepository()) {
        this.editorRepository = editorRepository;
    }

    /**
     * Carga un documento Y.Doc inicializado con el contenido de ArchivoProyecto en BD si existe.
     */
    public async initializeYDocForSession(sessionId: string, doc: Y.Doc): Promise<Y.Doc> {
        const projectFiles = await this.editorRepository.findBySessionId(sessionId);
        if (projectFiles) {
            const htmlText = doc.getText('index.html');
            const cssText = doc.getText('styles.css');
            const jsText = doc.getText('script.js');

            doc.transact(() => {
                if (htmlText.length === 0 && projectFiles.html) {
                    htmlText.insert(0, projectFiles.html);
                }
                if (cssText.length === 0 && projectFiles.css) {
                    cssText.insert(0, projectFiles.css);
                }
                if (jsText.length === 0 && projectFiles.javascript) {
                    jsText.insert(0, projectFiles.javascript);
                }
            });
        }
        return doc;
    }

    /**
     * Persiste el estado actual de un documento Y.Doc en la tabla ArchivoProyecto.
     */
    public async persistYDocState(sessionId: string, doc: Y.Doc): Promise<ArchivoProyecto> {
        const data: UpdateProjectFilesData = {
            html: doc.getText('index.html').toString(),
            css: doc.getText('styles.css').toString(),
            javascript: doc.getText('script.js').toString(),
        };
        return await this.editorRepository.updateBySessionId(sessionId, data);
    }
}
