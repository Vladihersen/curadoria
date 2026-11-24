// Perguntas do JEV usadas pelo Bem Viver. Todo o texto que vai ao modelo fica aqui,
// para ser lido e ajustado num lugar só. A decisão (o que fazer com as respostas)
// fica em funções de código logo abaixo, e não no modelo.
//
// Primeiro uso (exemplo, ainda não ligado ao app): ler o que a participante escreveu
// no domingo e marcar para o Vladimir o que pede atenção.

export const PERGUNTAS_DOMINGO = {
  mal_estar: {
    type: 'noul',
    instructions: 'Em `texto`, a participante conta que uma prática do método a deixou pior?',
    criteria: {
      true: 'Ela relata que, durante ou depois de uma prática, ficou mais ansiosa, tonta, com dor, falta de ar ou angustiada.',
      false: 'Ela não relata nenhum efeito ruim de uma prática, mesmo que fale de dificuldades da vida.',
    },
  },
  espera_resposta: {
    type: 'noul',
    instructions: 'Em `texto`, a participante faz uma pergunta ou um pedido que espera resposta do Vladimir?',
    criteria: {
      true: 'Há uma pergunta ou pedido dirigido ao Vladimir ou à equipe.',
      false: 'Ela só conta como foi a semana, sem perguntar nem pedir nada.',
    },
  },
  fala_do_estado: {
    type: 'noul',
    instructions: 'Em `texto`, a participante descreve como se sentiu nesta semana?',
  },
  estado: {
    type: 'choice',
    instructions: 'Como a participante descreve o próprio estado nesta semana, em `texto`?',
    criteria: {
      mais_calma: 'Ela se sentiu mais tranquila, leve ou em paz do que antes.',
      sem_mudanca: 'Ela diz que se sentiu como de costume, sem diferença clara.',
      mais_agitada: 'Ela se sentiu mais tensa, ansiosa ou cansada do que antes.',
    },
  },
};

// Limites de leitura de um "sim/não" (noul). Entre os dois, a resposta não está clara.
export const SIM = 0.7;
export const NAO = 0.3;

// Tabela de decisão. O mal-estar usa o limite baixo de propósito: na dúvida, o Vladimir olha.
export function decidirDomingo(answers) {
  const p = (nome) => answers[nome] && answers[nome].noul;
  const estado = p('fala_do_estado') >= SIM ? answers.estado.choice : null;
  return {
    olhar_com_cuidado: p('mal_estar') > NAO,
    responder: p('espera_resposta') >= SIM,
    estado, // null quando ela não fala de como se sentiu
  };
}

// Texto inventado, sem dados de ninguém, usado só no teste do painel.
export const TEXTO_EXEMPLO = 'Essa semana dormi melhor e fiquei mais tranquila no trabalho. '
  + 'Só no suspiro longo da quarta fiquei um pouco tonta. É normal? Devo fazer mais devagar?';
