
import React, { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type, FunctionDeclaration, ThinkingLevel } from "@google/genai";
import { DBState, User, TransactionType, UserRole } from '../types';
import { MessageSquare, Send, X, Bot, Sparkles, User as UserIcon, Mic, MicOff } from 'lucide-react';
import Markdown from 'react-markdown';
import { toTitleCase, getEffectiveDueDay } from '../utils';

interface AIAssistantProps {
  db: DBState;
  user: User;
  onAddClient: (data: { name: string; phone: string; groupId: string; initialCapital: number; dueDay: number; notes: string; startDate: string; firstDueDate: string }) => void;
  onAddTransaction: (data: { clientId: string; type: TransactionType; amount: number; description: string }) => void;
  onAddPayment: (data: { clientId: string; interestAmount: number; amortizationAmount: number; description: string }) => void;
  onAddSocio: (data: { name: string; email: string; phone: string; interestRate: number; password: string }) => void;
  onDeleteClient: (id: string) => void;
  onDeleteGroup: (id: string) => void;
  onRequestPayment: (clientId: string, interest: number, amortization: number, discount: number, obs: string) => void;
  onUpdateClient: (clientId: string, updates: any) => void;
  onUpdateSocio: (groupId: string, updates: any) => void;
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

const AIAssistant: React.FC<AIAssistantProps> = ({ db, user, onAddClient, onAddTransaction, onAddSocio, onAddPayment, onDeleteClient, onDeleteGroup, onRequestPayment, onUpdateClient, onUpdateSocio }) => {
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
        dueDay: { type: Type.NUMBER, description: "Dia de vencimento mensal (1-31). Derive da Data do Primeiro Vencimento." },
        startDate: { type: Type.STRING, description: "Data de início do empréstimo (YYYY-MM-DD)." },
        firstDueDate: { type: Type.STRING, description: "Data do primeiro vencimento (YYYY-MM-DD)." },
        notes: { type: Type.STRING, description: "Observações adicionais (opcional)" }
      },
      required: ["name", "phone", "groupId", "initialCapital", "dueDay", "startDate", "firstDueDate"]
    }
  };

  const registerTransactionTool: FunctionDeclaration = {
    name: "registerTransaction",
    parameters: {
      type: Type.OBJECT,
      description: "Registra uma nova transação (Investimento ou Retirada) para um cliente.",
      properties: {
        clientId: { type: Type.STRING, description: "ID do cliente" },
        type: { type: Type.STRING, description: "Tipo da transação: INVESTMENT ou WITHDRAWAL" },
        amount: { type: Type.NUMBER, description: "Valor da transação" },
        description: { type: Type.STRING, description: "Descrição ou motivo do lançamento" }
      },
      required: ["clientId", "type", "amount"]
    }
  };

  const registerPaymentTool: FunctionDeclaration = {
    name: "registerPayment",
    parameters: {
      type: Type.OBJECT,
      description: "Registra o pagamento de juros e/ou amortização de capital.",
      properties: {
        clientId: { type: Type.STRING, description: "ID do cliente" },
        interestAmount: { type: Type.NUMBER, description: "Valor pago referente aos JUROS" },
        amortizationAmount: { type: Type.NUMBER, description: "Valor pago para AMORTIZAR o capital" },
        description: { type: Type.STRING, description: "Descrição opcional" }
      },
      required: ["clientId", "interestAmount", "amortizationAmount"]
    }
  };

  const requestPaymentTool: FunctionDeclaration = {
    name: "requestPayment",
    parameters: {
      type: Type.OBJECT,
      description: "Cria uma solicitação de pagamento para ser aprovada pelo administrador. Use quando o usuário for um Sócio (VIEWER).",
      properties: {
        clientId: { type: Type.STRING, description: "ID do cliente" },
        interestAmount: { type: Type.NUMBER, description: "Valor dos juros" },
        amortizationAmount: { type: Type.NUMBER, description: "Valor da amortização" },
        discountAmount: { type: Type.NUMBER, description: "Valor do desconto (opcional)" },
        observation: { type: Type.STRING, description: "Observação ou motivo" }
      },
      required: ["clientId", "interestAmount", "amortizationAmount"]
    }
  };

  const deleteClientTool: FunctionDeclaration = {
    name: "deleteClient",
    parameters: {
      type: Type.OBJECT,
      description: "Exclui um cliente permanentemente do sistema. APENAS PARA ADMINISTRADORES.",
      properties: {
        clientId: { type: Type.STRING, description: "ID do cliente a ser excluído" }
      },
      required: ["clientId"]
    }
  };

  const deleteGroupTool: FunctionDeclaration = {
    name: "deleteGroup",
    parameters: {
      type: Type.OBJECT,
      description: "Exclui um sócio (grupo) e todos os seus dados permanentemente. APENAS PARA ADMINISTRADORES.",
      properties: {
        groupId: { type: Type.STRING, description: "ID do grupo/sócio a ser excluído" }
      },
      required: ["groupId"]
    }
  };
  
  const updateClientTool: FunctionDeclaration = {
    name: "updateClient",
    parameters: {
      type: Type.OBJECT,
      description: "Atualiza dados de um cliente (telefone, capital, sócio, vencimento, etc).",
      properties: {
        clientId: { type: Type.STRING, description: "ID do cliente" },
        updates: {
          type: Type.OBJECT,
          description: "Campos para atualizar",
          properties: {
            phone: { type: Type.STRING },
            initialCapital: { type: Type.NUMBER },
            currentCapital: { type: Type.NUMBER },
            dueDay: { type: Type.NUMBER },
            firstDueDate: { type: Type.NUMBER, description: "Timestamp da nova data de vencimento" },
            groupId: { type: Type.STRING }
          }
        }
      },
      required: ["clientId", "updates"]
    }
  };

  const updateSocioTool: FunctionDeclaration = {
    name: "updateSocio",
    parameters: {
      type: Type.OBJECT,
      description: "Atualiza dados de um sócio (nome, e-mail, telefone, taxa).",
      properties: {
        groupId: { type: Type.STRING, description: "ID do sócio" },
        updates: {
          type: Type.OBJECT,
          description: "Campos para atualizar",
          properties: {
            name: { type: Type.STRING },
            email: { type: Type.STRING },
            phone: { type: Type.STRING },
            interestRate: { type: Type.NUMBER }
          }
        }
      },
      required: ["groupId", "updates"]
    }
  };

  useEffect(() => {
    const handleOpenAI = (e: any) => {
      setIsOpen(true);
      if (e.detail?.message) {
        setInput(e.detail.message);
      }
    };
    window.addEventListener('open-ai', handleOpenAI as any);
    return () => window.removeEventListener('open-ai', handleOpenAI as any);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    const maxRetries = 2;
    let retryCount = 0;

    const callAI = async (): Promise<any> => {
      try {
        const apiKey = process.env.GEMINI_API_KEY || (import.meta.env.VITE_GEMINI_API_KEY as string);
        if (!apiKey) throw new Error("A chave de API não foi configurada.");

        const ai = new GoogleGenAI({ apiKey });
        
        const now = new Date();
        const todayDay = now.getDate();
        const todayMonth = now.getMonth();
        const todayYear = now.getFullYear();
        const todayDate = new Date(todayYear, todayMonth, todayDay);
        const tomorrowDate = new Date(todayYear, todayMonth, todayDay + 1);
        const tomorrowDay = tomorrowDate.getDate();
        const dateStr = now.toLocaleDateString('pt-BR');

        const clientStatus: Record<string, { vencido: number; hoje: number; futuro: number }> = {};
        const userGroupId = user.role === UserRole.VIEWER 
          ? (user.groupId || db.groups.find(g => g.email === user.email)?.id)
          : null;

        db.competences.forEach(cp => {
          if ((cp.originalValue - cp.paidAmount) > 0.01) {
            const client = db.clients.find(c => c.id === cp.clientId);
            if (!client || (userGroupId && client.groupId !== userGroupId)) return;
            
            const dueDay = getEffectiveDueDay(client.dueDay, cp.month, cp.year);
            const dueDate = new Date(cp.year, cp.month, dueDay);
            const pending = cp.originalValue - cp.paidAmount;
            
            if (!clientStatus[cp.clientId]) clientStatus[cp.clientId] = { vencido: 0, hoje: 0, futuro: 0 };
            
            if (dueDate < todayDate) clientStatus[cp.clientId].vencido += pending;
            else if (dueDate.getTime() === todayDate.getTime()) clientStatus[cp.clientId].hoje += pending;
            else clientStatus[cp.clientId].futuro += pending;
          }
        });

        const statsContext = {
          capital_total: db.clients.filter(c => !userGroupId || c.groupId === userGroupId).reduce((acc: number, c: any) => acc + c.currentCapital, 0),
          juros_vencidos_total: Object.values(clientStatus).reduce((acc, s) => acc + s.vencido, 0),
          juros_hoje_total: Object.values(clientStatus).reduce((acc, s) => acc + s.hoje, 0),
          juros_futuro_total: Object.values(clientStatus).reduce((acc, s) => acc + s.futuro, 0)
        };

        const context = {
          stats: statsContext,
          total_clientes: db.clients.filter(c => !userGroupId || c.groupId === userGroupId).length,
          socios_disponiveis: user.role === UserRole.ADMIN ? db.groups.map(g => ({ id: g.id, nome: g.name })) : [],
          clientes: db.clients
            .filter(c => !userGroupId || c.groupId === userGroupId)
            .slice(0, 150)
            .map(c => ({ 
              id: c.id, nome: c.name, capital_atual: c.currentCapital, 
              juros_vencidos: clientStatus[c.id]?.vencido || 0,
              juros_hoje: clientStatus[c.id]?.hoje || 0,
              juros_futuro: clientStatus[c.id]?.futuro || 0,
              vencimento_dia: c.dueDay,
              data_vencimento_atual: c.firstDueDate ? new Date(c.firstDueDate).toLocaleDateString('pt-BR') : null,
              grupo: db.groups.find(g => g.id === c.groupId)?.name
            }))
        };

        return await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [
            { role: 'model', parts: [{ text: "Olá! Sou o assistente CredPlus. Como posso ajudar?" }] },
            ...messages.slice(-10).map(m => ({ role: m.role, parts: [{ text: m.text }] })),
            { role: 'user', parts: [{ text: `Contexto: ${JSON.stringify(context)}. Entrada: ${userMessage}` }] }
          ],
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            systemInstruction: `Você é o assistente ultra-eficiente da CredPlus. 
            USUÁRIO ATUAL: ${user.email} (Função: ${user.role}).
            DATA ATUAL: ${dateStr} (Hoje é dia ${todayDay}).
            ADMINISTRADORES PRINCIPAIS: 1. Lellis Flávio (credplusemp@gmail.com), 2. Michael Douglas (michaeldsandes@gmail.com).
            SAUDAÇÃO: Identifique o usuário pelo e-mail e use o nome se for um dos ADMs acima.
            REGRAS: 
            - PRIVACIDADE: Só veja clientes do seu grupo.
            - EXCLUSÃO: Só ADMIN pode excluir. Peça confirmação.
            - PAGAMENTOS: ADMIN usa 'registerPayment', Sócio usa 'requestPayment'.
            - CONSULTA: Liste vencidos, hoje ou amanhã conforme solicitado.
            - CADASTRO: Colete dados necessários para Sócios e Clientes.
            - EDIÇÃO: Altere campos específicos conforme solicitado.
            - Seja CURTO e DIRETO.` ,
            tools: [{ functionDeclarations: [registerSocioTool, registerClientTool, registerTransactionTool, registerPaymentTool, requestPaymentTool, deleteClientTool, deleteGroupTool, updateClientTool, updateSocioTool] }]
          }
        });
      } catch (error: any) {
        const errorStr = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
        const is503 = errorStr.includes("503") || errorStr.includes("high demand") || errorStr.includes("UNAVAILABLE");
        
        if (is503 && retryCount < maxRetries) {
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, retryCount * 2000));
          return callAI();
        }
        throw error;
      }
    };

    try {
      const response = await callAI();
      const functionCalls = response.functionCalls;
      if (functionCalls && functionCalls.length > 0) {
        for (const call of functionCalls) {
          if (call.name === "registerSocio") {
            const args = call.args as any;
            onAddSocio({ ...args, name: toTitleCase(args.name) });
            setMessages(prev => [...prev, { role: 'model', text: `✅ Sócio **${toTitleCase(args.name)}** cadastrado com sucesso!` }]);
          } else if (call.name === "registerClient") {
            const args = call.args as any;
            onAddClient({ ...args, name: toTitleCase(args.name) });
            setMessages(prev => [...prev, { role: 'model', text: `✅ Cliente **${toTitleCase(args.name)}** registrado com sucesso!` }]);
          } else if (call.name === "registerTransaction") {
            onAddTransaction(call.args as any);
            setMessages(prev => [...prev, { role: 'model', text: `✅ Lançamento registrado com sucesso!` }]);
          } else if (call.name === "registerPayment") {
            const args = call.args as any;
            if (user.role === UserRole.ADMIN) {
              onAddPayment(args);
              const client = db.clients.find(c => c.id === args.clientId);
              const newCap = (client?.currentCapital || 0) - args.amortizationAmount;
              setMessages(prev => [...prev, { role: 'model', text: `✅ Pagamento de **${client?.name}** processado!\n- Juros pagos: R$ ${args.interestAmount}\n- Amortização: R$ ${args.amortizationAmount}\n- **Novo Capital: R$ ${newCap}**` }]);
            } else {
              onRequestPayment(args.clientId, args.interestAmount, args.amortizationAmount, 0, args.description || 'Solicitado via Agente');
              setMessages(prev => [...prev, { role: 'model', text: `⏳ Solicitação de pagamento enviada para o Administrador confirmar.` }]);
            }
          } else if (call.name === "requestPayment") {
            const args = call.args as any;
            onRequestPayment(args.clientId, args.interestAmount, args.amortizationAmount, args.discountAmount || 0, args.observation || 'Solicitado via Agente');
            setMessages(prev => [...prev, { role: 'model', text: `⏳ Solicitação de pagamento enviada para o Administrador confirmar.` }]);
          } else if (call.name === "deleteClient") {
            const args = call.args as any;
            if (user.role === 'ADMIN') {
              const client = db.clients.find(c => c.id === args.clientId);
              if (client) {
                await (onDeleteClient as any)(args.clientId);
                setMessages(prev => [...prev, { role: 'model', text: `🗑️ Cliente **${client.name}** excluído.` }]);
              }
            }
          } else if (call.name === "deleteGroup") {
            const args = call.args as any;
            if (user.role === 'ADMIN') {
              const group = db.groups.find(g => g.id === args.groupId);
              if (group) {
                await (onDeleteGroup as any)(args.groupId);
                setMessages(prev => [...prev, { role: 'model', text: `🗑️ Sócio **${group.name}** excluído.` }]);
              }
            }
          } else if (call.name === "updateClient") {
            const args = call.args as any;
            onUpdateClient(args.clientId, args.updates);
            setMessages(prev => [...prev, { role: 'model', text: `✅ Dados do cliente atualizados!` }]);
          } else if (call.name === "updateSocio") {
            const args = call.args as any;
            onUpdateSocio(args.groupId, args.updates);
            setMessages(prev => [...prev, { role: 'model', text: `✅ Dados do sócio atualizados!` }]);
          }
        }
      } else {
        const aiResponse = response.text;
        setMessages(prev => [...prev, { role: 'model', text: aiResponse || "⚠️ O assistente não conseguiu gerar uma resposta." }]);
      }
    } catch (error: any) {
      console.error("AI Error:", error);
      const errorStr = typeof error === 'string' ? error : (error.message || JSON.stringify(error));
      let errorMsg = "Erro ao processar sua solicitação.";
      
      if (errorStr.includes("503") || errorStr.includes("high demand") || errorStr.includes("UNAVAILABLE")) {
        errorMsg = "O serviço de IA está com alta demanda no momento. Por favor, tente novamente em alguns segundos.";
      } else if (errorStr.includes("fetch")) {
        errorMsg = "Falha de conexão. Verifique sua internet.";
      } else if (errorStr.includes("API key")) {
        errorMsg = "Configuração de API pendente.";
      }

      setMessages(prev => [...prev, { role: 'model', text: `❌ **Falha no Agente:** ${errorMsg}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Botão Flutuante */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-emerald-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-[60] border-b-4 border-emerald-800"
      >
        <Bot size={28} />
      </button>

      {/* Janela do Chat */}
      {isOpen && (
        <div className="fixed inset-x-3 bottom-3 top-12 md:inset-auto md:bottom-24 md:right-6 md:w-[400px] md:h-[600px] bg-white rounded-[2rem] md:rounded-[2.5rem] shadow-2xl flex flex-col z-[70] overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-10 duration-300">
          {/* Header */}
          <div className="bg-emerald-700 p-4 md:p-6 text-white flex items-center justify-between border-b-4 border-emerald-900">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-white/20 rounded-xl backdrop-blur-md">
                <Sparkles size={18} className="text-amber-300" />
              </div>
              <div>
                <h3 className="font-black uppercase tracking-tighter text-sm md:text-lg">Agente CredPlus</h3>
                <p className="text-[8px] md:text-[10px] font-bold text-emerald-200 uppercase tracking-widest">Inteligência Artificial</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <X size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-6 space-y-3 md:space-y-4 bg-slate-50">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] md:max-w-[85%] p-3 md:p-4 rounded-2xl text-xs md:text-sm shadow-sm ${
                  msg.role === 'user' 
                  ? 'bg-emerald-600 text-white rounded-tr-none' 
                  : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                }`}>
                  <div className="flex items-center gap-2 mb-1 opacity-50 text-[9px] font-black uppercase tracking-widest">
                    {msg.role === 'user' ? <UserIcon size={9}/> : <Bot size={9}/>}
                    {msg.role === 'user' ? 'Você' : 'Assistente'}
                  </div>
                  <div className="prose prose-sm max-w-none prose-emerald leading-relaxed">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 flex gap-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce"></div>
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-100"></div>
                  <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-bounce delay-200"></div>
                </div>
              </div>
            )}
          </div>

          {/* Input Area */}
          <div className="p-3 md:p-4 bg-white border-t border-slate-100 pb-safe">
            <div className="relative flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isListening ? "Ouvindo..." : "Pergunte algo..."}
                  className={`w-full pl-4 pr-10 py-3 md:py-4 bg-slate-100 border-none rounded-xl md:rounded-2xl text-xs md:text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none font-medium ${isListening ? 'ring-2 ring-red-400 animate-pulse' : ''}`}
                />
                <button
                  onClick={toggleListening}
                  className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${isListening ? 'bg-red-500 text-white' : 'bg-slate-200 text-slate-600 hover:bg-slate-300'}`}
                >
                  {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={isLoading || !input.trim()}
                className="p-3 md:p-4 bg-emerald-600 text-white rounded-xl md:rounded-2xl hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-md shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIAssistant;
