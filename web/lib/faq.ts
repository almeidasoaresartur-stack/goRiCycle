export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "o-que-e",
    question: "O que é o goRiCycle?",
    answer:
      "O goRiCycle é um agregador de tecnologia recondicionada em Portugal. Comparamos preços e condições de lojas parceiras de confiança para te ajudar a encontrar a melhor opção em segunda mão.",
  },
  {
    id: "vende-directamente",
    question: "O goRiCycle vende os aparelhos directamente?",
    answer:
      "Não. Nós não vendemos telemóveis nem processamos pagamentos. Apenas comparamos e redirecionamos para as lojas oficiais, onde podes concluir a compra em total segurança.",
  },
  {
    id: "graus",
    question: "Como funcionam os Estados Estéticos?",
    answer:
      "Cada loja usa nomenclaturas diferentes (como «Como Novo», «Excelente» ou «Satisfatório»). Normalizámos tudo em três categorias universais: ✨ Premium (estado impecável), 👍 Excelente (marcas mínimas quase invisíveis) e 🌱 Bom (sinais visíveis de uso, preço mais baixo).",
  },
  {
    id: "garantia",
    question: "Os produtos têm garantia?",
    answer:
      "Sim. Os produtos recondicionados vendidos por lojas profissionais em Portugal têm direito a garantia — geralmente entre 1 a 3 anos, dependendo da loja parceira. Confirma sempre as condições exactas no site de destino antes de comprar.",
  },
];
