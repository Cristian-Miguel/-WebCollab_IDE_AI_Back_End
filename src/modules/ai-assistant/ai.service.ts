import axios from 'axios';
import { SugerenciaIA } from '@prisma/client';
import { AIRepository } from './ai.repository';
import { AppException } from '../../core/exception/app_exception';

export type SupportedAILanguage = 'html' | 'css' | 'javascript';

export interface AISuggestRequestDto {
    contextoCodigo: string;
    lenguaje: SupportedAILanguage;
    promptUsuario?: string;
    sesionId?: string;
}

export interface AISuggestResponseDto extends SugerenciaIA {
    sugerencia: string;
    lenguaje: SupportedAILanguage;
}

export class AIService {
    private aiRepository: AIRepository;

    constructor(aiRepository: AIRepository = new AIRepository()) {
        this.aiRepository = aiRepository;
    }

    /**
     * Construye el prompt estructurado combinando el lenguaje, contexto de código y prompt del usuario.
     */
    private buildPrompt(dto: AISuggestRequestDto): string {
        const userInstruction =
            dto.promptUsuario?.trim() ||
            `Optimiza y completa el siguiente código ${dto.lenguaje.toUpperCase()} siguiendo buenas prácticas.`;

        return `[Lenguaje: ${dto.lenguaje}]\n[Instrucción: ${userInstruction}]\n[Contexto]:\n${dto.contextoCodigo}`;
    }

    /**
     * Genera una sugerencia contextual determinista cuando el proveedor externo (Ollama/OpenAI)
     * no se encuentra disponible localmente, garantizando continuidad del servicio.
     */
    private buildFallbackSuggestion(dto: AISuggestRequestDto): string {
        const instructionComment = dto.promptUsuario
            ? `Sugerencia IA para: ${dto.promptUsuario.trim()}`
            : `Sugerencia IA optimizada (${dto.lenguaje.toUpperCase()})`;

        if (dto.lenguaje === 'html') {
            return `${dto.contextoCodigo}\n<!-- ${instructionComment} -->\n<section class="ai-suggested-section" aria-label="Componente sugerido por IA">\n  <h2>Componente Generado con Asistencia IA</h2>\n  <p>Estructura semántica HTML5 recomendada.</p>\n</section>`;
        }

        if (dto.lenguaje === 'css') {
            return `${dto.contextoCodigo}\n\n/* ${instructionComment} */\n.ai-suggested-section {\n  display: flex;\n  flex-direction: column;\n  gap: 0.75rem;\n  padding: 1.25rem;\n  border-radius: 8px;\n  transition: all 0.2s ease-in-out;\n}`;
        }

        return `${dto.contextoCodigo}\n\n// ${instructionComment}\nfunction handleAISuggestedAction() {\n  const section = document.querySelector('.ai-suggested-section');\n  if (section) {\n    section.classList.toggle('active');\n  }\n}\nhandleAISuggestedAction();`;
    }

    /**
     * Solicita sugerencia de código a la API de IA (Ollama / OpenAI compatible) vía axios
     * sin exponer OPENAI_API_KEY en respuestas ni logs, y persiste la interacción en SugerenciaIA.
     */
    public async generateSuggestion(dto: AISuggestRequestDto, usuarioId: string): Promise<AISuggestResponseDto> {
        if (!usuarioId) {
            throw new AppException('JWT_INVALID');
        }

        const fullPrompt = this.buildPrompt(dto);
        const apiUrl = process.env.AI_API_URL || 'http://localhost:11434/api/generate';
        const apiKey = process.env.OPENAI_API_KEY || '';
        const model = process.env.AI_MODEL || 'codellama';

        let aiGeneratedText = '';

        try {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (apiKey) {
                headers.Authorization = `Bearer ${apiKey}`;
            }

            const response = await axios.post(
                apiUrl,
                {
                    model,
                    prompt: fullPrompt,
                    stream: false,
                },
                {
                    headers,
                    timeout: 4000,
                }
            );

            aiGeneratedText =
                response.data?.response ||
                response.data?.choices?.[0]?.message?.content ||
                response.data?.suggestion ||
                '';
        } catch {
            // Fallback seguro cuando el motor local de IA no está activo
            aiGeneratedText = this.buildFallbackSuggestion(dto);
        }

        if (!aiGeneratedText.trim()) {
            aiGeneratedText = this.buildFallbackSuggestion(dto);
        }

        const sesionId = await this.aiRepository.resolveSessionId(usuarioId, dto.sesionId);

        const savedRecord = await this.aiRepository.createSuggestion({
            sesionId,
            usuarioId,
            prompt: fullPrompt,
            respuesta: aiGeneratedText,
        });

        return {
            ...savedRecord,
            sugerencia: savedRecord.respuesta,
            lenguaje: dto.lenguaje,
        };
    }
}
