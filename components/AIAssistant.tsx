
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
  onAddPayment: (data: { clientId: string; interestAmount: number; amortizationAmount: number; description: string }) => void;
  onAddSocio: (data: { name: string; email: string; phone: string; interestRate: number; password: string }) => void;
  onDeleteClient: (id: string) => void;
  onDeleteGroup: (id: string) => void;
  onRequestPayment: (clientId: string, interest: number, amortization: number, discount: number, obs: string) => void;
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

const AIAssistant: React.FC<AIAssistantProps> = ({ db, user, onAddClient, onAddTransaction, onAddSocio, onAddPayment, onDeleteClient, onDeleteGroup, onRequestPayment }) => {
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
        clientes: db.clients.map(c => {
          const clientCompetences = db.competences.filter(cp => cp.clientId === c.id && cp.paidAmount < cp.originalValue);
          const totalInterestPending = clientCompetences.reduce((sum, cp) => sum + (cp.originalValue - cp.paidAmount), 0);
          return { 
            id: c.id,
            nome: c.name, 
            capital_atual: c.currentCapital, 
            juros_pendentes: totalInterestPending,
            vencimento_dia: c.dueDay,
            grupo: db.groups.find(g => g.id === c.groupId)?.name
          };
        })
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
          USUÁRIO ATUAL: ${user.email} (Função: ${user.role}).
          DATA ATUAL: 22/02/2026 (Hoje é dia 22).
          
          ADMINISTRADORES PRINCIPAIS (INREMOVÍVEIS):
          1. credplusemp@gmail.com -> Nome: Lellis Flávio (ADM 1)
          2. michaeldsandes@gmail.com -> Nome: Michael Douglas (ADM 2)
          
          SAUDAÇÃO:
          - Sempre identifique o usuário pelo e-mail e, se for um dos administradores acima, use o nome dele para cumprimentá-lo (ex: "Olá, Lellis Flávio!" ou "Olá, Michael Douglas!").
          
          REGRAS DE PERMISSÃO:
          - EXCLUSÃO: Apenas se a função for 'ADMIN'. Se o usuário pedir para excluir e for 'VIEWER', diga educadamente que não tem permissão para isso.
          - PAGAMENTOS: 
            - Se for 'ADMIN', use 'registerPayment' para dar baixa imediata.
            - Se for 'VIEWER' (Sócio), use 'registerPayment' mas informe que será gerada uma SOLICITAÇÃO para o administrador confirmar.
          
          REGRAS CRÍTICAS:
          1. MEMÓRIA: Se o usuário já disse um dado, NUNCA peça novamente.
          2. FORMATO DE LISTA: Responda APENAS com a lista do que falta.
          3. EXCLUSÃO: Após chamar a ferramenta de exclusão, confirme APENAS UMA VEZ. Não repita a exclusão se o usuário mudar de assunto.
          
          FLUXO DE CONSULTA (Vencimentos):
          - Gatilhos: "quem vence hoje", "quem vence amanhã", "vencidos", "atrasados".
          - Formato de resposta (um por linha):
            "• [Nome] | Cap: R$ [Capital] | Juros: R$ [Juros] | Sócio: [Sócio]"
          - Regra Vencidos: Clientes com 'vencimento_dia' menor que 22 e 'juros_pendentes' > 0.
          - Regra Hoje: Clientes com 'vencimento_dia' igual a 22.
          - Regra Amanhã: Clientes com 'vencimento_dia' igual a 23.

          FLUXO DE PAGAMENTO/BAIXA (Gatilho: "pagamento", "dar baixa", "pagou"):
          - Lista: 1. Valor dos Juros, 2. Amortizar Capital, 3. Descrição (opcional).
          - Se o usuário disser "Pagamento de Valdomiro", veja no contexto quanto ele deve de juros e capital e confirme:
            "Ok! Para Valdomiro (Dívida: R$ [capital], Juros: R$ [juros]), informe:
            1. Valor dos Juros:
            2. Amortizar Capital:
            3. Descrição:"

          FLUXO DE SÓCIO:
          - Lista: 1. Nome, 2. Email, 3. Fone, 4. Taxa de Juros, 5. Senha.

          FLUXO DE CLIENTE:
          - Lista: 1. Nome, 2. Fone, 3. Sócio, 4. Capital, 5. Vencimento.

          REGRAS GERAIS:
          - Seja CURTO e DIRETO.
          - Use a ferramenta 'registerPayment' para pagamentos de juros/capital.
          - Use a ferramenta 'registerTransaction' APENAS para Investimentos ou Retiradas puras.
          - Use a ferramenta 'deleteClient' ou 'deleteGroup' se o usuário ADMIN pedir para excluir.
          - Identifique o Cliente pelo nome fornecido no contexto.`,
          tools: [{ functionDeclarations: [registerSocioTool, registerClientTool, registerTransactionTool, registerPaymentTool, deleteClientTool, deleteGroupTool] }]
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
            setMessages(prev => [...prev, { role: 'model', text: `✅ Lançamento registrado com sucesso!` }]);
          }
          if (call.name === "registerPayment") {
            const args = call.args as any;
            if (user.role === 'ADMIN') {
              onAddPayment(args);
              const client = db.clients.find(c => c.id === args.clientId);
              const newCap = (client?.currentCapital || 0) - args.amortizationAmount;
              setMessages(prev => [...prev, { role: 'model', text: `✅ Pagamento de **${client?.name}** processado!\n- Juros pagos: R$ ${args.interestAmount}\n- Amortização: R$ ${args.amortizationAmount}\n- **Novo Capital: R$ ${newCap}**` }]);
            } else {
              onRequestPayment(args.clientId, args.interestAmount, args.amortizationAmount, 0, args.description || 'Solicitado via Agente');
              setMessages(prev => [...prev, { role: 'model', text: `⏳ Solicitação de pagamento enviada para o Administrador confirmar. Aguarde a aprovação.` }]);
            }
          }
          if (call.name === "deleteClient") {
            const args = call.args as any;
            if (user.role === 'ADMIN') {
              const client = db.clients.find(c => c.id === args.clientId);
              if (client) {
                await (onDeleteClient as any)(args.clientId);
                setMessages(prev => [...prev, { role: 'model', text: `🗑️ Cliente **${client.name}** excluído permanentemente.` }]);
              } else {
                setMessages(prev => [...prev, { role: 'model', text: `⚠️ Cliente não encontrado para exclusão.` }]);
              }
            } else {
              setMessages(prev => [...prev, { role: 'model', text: `❌ Você não tem permissão para excluir clientes.` }]);
            }
          }
          if (call.name === "deleteGroup") {
            const args = call.args as any;
            if (user.role === 'ADMIN') {
              const group = db.groups.find(g => g.id === args.groupId);
              if (group) {
                await (onDeleteGroup as any)(args.groupId);
                setMessages(prev => [...prev, { role: 'model', text: `🗑️ Sócio **${group.name}** e todos os seus dados foram excluídos.` }]);
              } else {
                setMessages(prev => [...prev, { role: 'model', text: `⚠️ Sócio não encontrado para exclusão.` }]);
              }
            } else {
              setMessages(prev => [...prev, { role: 'model', text: `❌ Você não tem permissão para excluir sócios.` }]);
            }
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
        <div className="fixed inset-0 md:inset-auto md:bottom-24 md:right-6 md:w-[400px] md:h-[600px] bg-white md:rounded-[2.5rem] shadow-2xl flex flex-col z-[60] overflow-hidden border border-slate-200 animate-in slide-in-from-bottom-10 duration-300">
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
