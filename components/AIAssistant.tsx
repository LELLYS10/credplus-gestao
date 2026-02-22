
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { DBState, User, TransactionType } from '../types';
import { MessageSquare, Send, X, Bot, Sparkles, User as UserIcon, Mic, MicOff } from 'lucide-react';
import Markdown from 'react-markdown';

interface AIAssistantProps {
  db: DBState;
  user: User;
  onAddClient: (data: { name: string; phone: string; groupId: string; initialCapital: number; dueDay: number; notes: string }) => void;
  onAddTransaction: (data: { clientId: string; type: TransactionType; amount: number; description: string }) => void;
  onAddSocio: (data: { name: string; email: string; phone: string; interestRate: number; password: string }) => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
}

// Declarando tipos para Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const AIAssistant: React.FC<AIAssistantProps> = ({ db, user, onAddClient, onAddTransaction, onAddSocio }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: `Olá! Sou o assistente CredPlus. 🤖\n\nComo posso ajudar hoje? Você pode cadastrar sócios, clientes ou lançamentos.` }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'pt-BR';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(transcript);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (error) {
        console.error('Speech recognition start error:', error);
      }
    }
  };

  const registerSocioTool: FunctionDeclaration = {
    name: "registerSocio",
    parameters: {
      type: Type.OBJECT,
      description: "Registra um novo sócio (grupo) no sistema.",
      properties: {
        name: { type: Type.STRING, description: "Nome do sócio" },
        email: { type: Type.STRING, description: "E-mail do sócio" },
        phone: { type: Type.STRING, description: "Telefone do sócio" },
        interestRate: { type: Type.NUMBER, description: "Taxa de juros mensal (%)" },
        password: { type: Type.STRING, description: "Senha de acesso" }
      },
      required: ["name", "email", "phone", "interestRate", "password"]
    }
  };

  const registerClientTool: FunctionDeclaration = {
    name: "registerClient",
    parameters: {
      type: Type.OBJECT,
      description: "Registra um novo cliente no sistema.",
      properties: {
        name: { type: Type.STRING, description: "Nome do cliente" },
        phone: { type: Type.STRING, description: "Telefone de contato" },
        groupId: { type: Type.STRING, description: "ID do grupo/sócio responsável" },
        initialCapital: { type: Type.NUMBER, description: "Capital inicial investido" },
        dueDay: { type: Type.NUMBER, description: "Dia de vencimento mensal (1-31)" },
        notes: { type: Type.STRING, description: "Observações adicionais (opcional)" }
      },
      required: ["name", "phone", "groupId", "initialCapital", "dueDay"]
    }
  };

  const registerTransactionTool: FunctionDeclaration = {
    name: "registerTransaction",
    parameters: {
      type: Type.OBJECT,
      description: "Registra uma nova transação (Investimento, Retirada ou Amortização) para um cliente.",
      properties: {
        clientId: { type: Type.STRING, description: "ID do cliente" },
        type: { type: Type.STRING, description: "Tipo da transação: INVESTMENT, WITHDRAWAL ou AMORTIZATION" },
        amount: { type: Type.NUMBER, description: "Valor da transação" },
        description: { type: Type.STRING, description: "Descrição ou motivo do lançamento" }
      },
      required: ["clientId", "type", "amount"]
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      // Tenta pegar a chave de ambos os lugares para garantir funcionamento no celular/Vercel
      const apiKey = process.env.GEMINI_API_KEY || (import.meta.env.VITE_GEMINI_API_KEY as string);
      
      if (!apiKey) {
        throw new Error("A chave de API não foi configurada. No Vercel, adicione a variável VITE_GEMINI_API_KEY.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const context = {
        total_clientes: db.clients.length,
        socios_disponiveis: db.groups.map(g => ({ id: g.id, nome: g.name })),
        clientes: db.clients.map(c => ({ 
          id: c.id,
          nome: c.name, 
          capital: c.currentCapital, 
          grupo: db.groups.find(g => g.id === c.groupId)?.name
        }))
      };

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [
          { role: 'model', parts: [{ text: "Olá! Sou o assistente CredPlus. Como posso ajudar?" }] },
          ...messages.map(m => ({ role: m.role, parts: [{ text: m.text }] })),
          { role: 'user', parts: [{ text: `Contexto: ${JSON.stringify(context)}. Entrada: ${userMessage}` }] }
        ],
        config: {
          systemInstruction: `Você é o assistente ultra-eficiente da CredPlus. 
          REGRAS CRÍTICAS:
          1. MEMÓRIA: Se o usuário já disse um dado (ex: Nome ou Sócio), NUNCA peça novamente.
          2. FORMATO DE LISTA: Sempre que faltar dados, responda APENAS com a lista do que falta, marcando o que já tem.
          
          FLUXO DE SÓCIO (Gatilho: "cadastrar sócio", "novo sócio"):
          - Lista: 1. Nome, 2. Email, 3. Fone, 4. Taxa de Juros, 5. Senha.
          - Se o usuário disse "Cadastrar João como sócio", responda:
            "Ok! Para o sócio João, informe:
            2. Email:
            3. Fone:
            4. Taxa de Juros:
            5. Senha:"

          FLUXO DE CLIENTE (Gatilho: "cadastrar cliente", "novo cliente", ou nomes soltos):
          - Lista: 1. Nome, 2. Fone, 3. Sócio (liste os disponíveis), 4. Capital, 5. Vencimento.
          - Se o usuário disse "Flavio, sócio JOAO", responda:
            "Ok! Para o cliente Flavio (Sócio: JOAO), informe:
            2. Fone:
            4. Capital:
            5. Vencimento:"

          REGRAS GERAIS:
          - Seja CURTO. Sem "Por favor", sem "Olá novamente". Vá direto ao ponto.
          - Use a ferramenta assim que o ÚLTIMO dado for fornecido.
          - Ignore maiúsculas/minúsculas.
          - Identifique o Sócio pelo nome fornecido no contexto.`,
          tools: [{ functionDeclarations: [registerSocioTool, registerClientTool, registerTransactionTool] }]
        }
      });

      const functionCalls = response.functionCalls;
      if (functionCalls) {
        for (const call of functionCalls) {
          if (call.name === "registerSocio") {
            onAddSocio(call.args as any);
            setMessages(prev => [...prev, { role: 'model', text: `✅ Sócio **${(call.args as any).name}** cadastrado com sucesso!` }]);
          }
          if (call.name === "registerClient") {
            onAddClient(call.args as any);
            setMessages(prev => [...prev, { role: 'model', text: `✅ Cliente **${(call.args as any).name}** registrado com sucesso!` }]);
          }
          if (call.name === "registerTransaction") {
            onAddTransaction(call.args as any);
            setMessages(prev => [...prev, { role: 'model', text: `✅ Lançamento de **R$ ${(call.args as any).amount}** registrado com sucesso!` }]);
          }
        }
      } else {
        const aiResponse = response.text || "Desculpe, não entendi.";
        setMessages(prev => [...prev, { role: 'model', text: aiResponse }]);
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      const errorMsg = error.message || "Erro desconhecido";
      setMessages(prev => [...prev, { role: 'model', text: `❌ **Erro no Agente:** ${errorMsg}\n\nVerifique se a variável GEMINI_API_KEY está configurada no seu ambiente.` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Botão Flutuante */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 border-b-4 border-emerald-800"
      >
        <Bot size={28} />
      </button>

      {/* Janela do Chat */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-full max-w-[400px] h-[600px] bg-white rounded-[2.5rem] shadow-2xl flex flex-col z-50 overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-10 duration-300">
          {/* Header */}
          <div className="bg-emerald-700 p-6 text-white flex items-center justify-between border-b-4 border-emerald-900">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl backdrop-blur-md">
                <Sparkles size={20} className="text-amber-300" />
              </div>
              <div>
                <h3 className="font-black uppercase tracking-tighter text-lg">Agente CredPlus</h3>
                <p className="text-[10px] font-bold text-emerald-200 uppercase tracking-widest">Inteligência Artificial</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-4 rounded-2xl text-sm shadow-sm ${
                  msg.role === 'user' 
                  ? 'bg-emerald-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                }`}>
                  <div className="flex items-center gap-2 mb-1 opacity-50 text-[10px] font-black uppercase tracking-widest">
                    {msg.role === 'user' ? <UserIcon size={10}/> : <Bot size={10}/>}
                    {msg.role === 'user' ? 'Você' : 'Assistente'}
                  </div>
                  <div className="prose prose-sm max-w-none prose-emerald">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex gap-2">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-4 bg-white border-t border-slate-100">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isListening ? "Ouvindo..." : "Pergunte algo..."}
                  className={`w-full pl-4 pr-12 py-4 bg-slate-100 border-none rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none font-medium ${isListening ? 'ring-2 ring-red-400 animate-pulse' : ''}`}
                />
                <button
                  onClick={toggleListening}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="p-4 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-md"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
