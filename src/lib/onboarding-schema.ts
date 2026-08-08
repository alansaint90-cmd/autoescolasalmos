export type OnboardingField = {
  key: string;
  label: string;
  type?: "text" | "textarea";
  placeholder?: string;
};

export type OnboardingSection = {
  id: string;
  title: string;
  description: string;
  fields: OnboardingField[];
};

export const onboardingSections: OnboardingSection[] = [
  {
    id: "school",
    title: "Dados da Autoescola",
    description: "Identificacao principal para personalizar o agente.",
    fields: [
      { key: "schoolName", label: "Nome da autoescola" },
      { key: "legalName", label: "Razao social" },
      { key: "cnpj", label: "CNPJ" },
      { key: "responsibleName", label: "Responsavel pelo projeto" },
      { key: "responsibleRole", label: "Cargo do responsavel" },
      { key: "address", label: "Endereco completo", type: "textarea" },
      { key: "whatsapp", label: "WhatsApp principal" },
      { key: "instagram", label: "Instagram" },
      { key: "googleProfile", label: "Google/Maps" },
      { key: "site", label: "Site" }
    ]
  },
  {
    id: "hours",
    title: "Horarios",
    description: "Horarios presenciais, WhatsApp e excecoes.",
    fields: [
      { key: "businessHours", label: "Horario comercial", type: "textarea" },
      { key: "whatsappHours", label: "Horario de atendimento pelo WhatsApp", type: "textarea" },
      { key: "afterHoursRule", label: "Como responder fora do horario?", type: "textarea" }
    ]
  },
  {
    id: "services",
    title: "Servicos",
    description: "Servicos, categorias, aulas e veiculos.",
    fields: [
      { key: "servicesOffered", label: "Servicos oferecidos", type: "textarea" },
      { key: "categories", label: "Categorias A, B, AB, adicao e mudanca", type: "textarea" },
      { key: "licenseProcess", label: "Processo de habilitacao", type: "textarea" },
      { key: "theoryClasses", label: "Aulas teoricas", type: "textarea" },
      { key: "practicalClasses", label: "Aulas praticas", type: "textarea" },
      { key: "vehicles", label: "Veiculos", type: "textarea" }
    ]
  },
  {
    id: "prices",
    title: "Precos",
    description: "Valores, pacotes, formas de pagamento e taxas.",
    fields: [
      { key: "prices", label: "Precos", type: "textarea" },
      { key: "paymentMethods", label: "Formas de pagamento", type: "textarea" },
      { key: "installments", label: "Parcelamento", type: "textarea" },
      { key: "packages", label: "Pacotes", type: "textarea" },
      { key: "includedItems", label: "O que esta incluso nos pacotes?", type: "textarea" },
      { key: "additionalFees", label: "Taxas adicionais", type: "textarea" },
      { key: "requiredDocuments", label: "Documentos necessarios", type: "textarea" }
    ]
  },
  {
    id: "commercial",
    title: "Comercial",
    description: "Promocoes, perguntas, objecoes e diferenciais.",
    fields: [
      { key: "promotions", label: "Promocoes", type: "textarea" },
      { key: "frequentQuestions", label: "Perguntas frequentes", type: "textarea" },
      { key: "mainObjections", label: "Objecoes", type: "textarea" },
      { key: "commercialDifferentials", label: "Diferenciais", type: "textarea" },
      { key: "socialProof", label: "Avaliacoes e provas sociais", type: "textarea" }
    ]
  },
  {
    id: "aiRules",
    title: "Regras de atendimento",
    description: "Como a IA deve conduzir, qualificar e limitar o atendimento.",
    fields: [
      { key: "toneOfVoice", label: "Tom de voz", type: "textarea" },
      { key: "qualificationQuestions", label: "Qualificacao: perguntas que a IA deve fazer", type: "textarea" },
      { key: "finalGoal", label: "Objetivo final do atendimento", type: "textarea" },
      { key: "followUpRules", label: "Follow-up", type: "textarea" },
      { key: "humanTransferRules", label: "Transferencia para humano", type: "textarea" },
      { key: "forbiddenInfo", label: "Informacoes que a IA nao pode responder", type: "textarea" }
    ]
  },
  {
    id: "materials",
    title: "Materiais comerciais",
    description: "Logo, tabela de precos, PDFs, fotos e materiais de apoio.",
    fields: [
      { key: "materialsNotes", label: "Observacoes sobre os materiais", type: "textarea" }
    ]
  }
];
