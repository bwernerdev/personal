// Guias de execução de cada exercício (texto fixo, escrito para a aba "Exercícios").
// A chave é o nome do exercício como está na rotina. Campos: imagem (pasta no banco free-exercise-db), grupo, musculos, passos[], dica, erro.
// Orientação geral, não substitui o personal: em dúvida ou dor, siga a orientação dele.

// Fotos (início e fim do movimento): banco free-exercise-db (domínio público, Unlicense), via jsDelivr.
export const URL_IMAGENS = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/';

export const GUIAS = {
  'Supino inclinado halter': {
    imagem: 'Incline_Dumbbell_Press', grupo: 'Peito', musculos: 'Parte alta do peito, ombro (frente), tríceps',
    passos: ['Banco inclinado a 30–45°; sente com os halteres nas coxas e deite levando-os ao peito.', 'Escápulas juntas e para baixo, pés firmes no chão.', 'Empurre os halteres para cima até quase estender os cotovelos, sem bater um no outro.', 'Desça devagar (2–3 s) até a altura do peito.'],
    dica: 'Cotovelos a cerca de 45° do tronco, não abertos a 90°.', erro: 'Inclinar o banco demais: vira exercício de ombro.',
  },
  'Supino chest press': {
    imagem: 'Machine_Bench_Press', grupo: 'Peito', musculos: 'Peito, ombro (frente), tríceps',
    passos: ['Ajuste o banco para que as pegadas fiquem na altura do meio do peito.', 'Costas apoiadas, escápulas juntas, pés no chão.', 'Empurre até quase estender os cotovelos.', 'Volte controlando até sentir o peito alongar.'],
    dica: 'Não tire as costas do encosto nem os ombros para a frente.', erro: 'Travar os cotovelos no final e soltar a carga na volta.',
  },
  'Crossover (polia alta)': {
    imagem: 'Cable_Crossover', grupo: 'Peito', musculos: 'Peito (fibras de baixo), ombro (frente)',
    passos: ['Polias no alto; um passo à frente, tronco levemente inclinado, uma perna na frente.', 'Cotovelos levemente flexionados e fixos.', 'Traga as mãos em arco para baixo e para a frente, até se encontrarem na altura do quadril.', 'Volte devagar até sentir o peito abrir.'],
    dica: 'Pense em "abraçar" uma árvore; o movimento sai do peito, não dos braços.', erro: 'Dobrar e esticar os cotovelos, virando tríceps.',
  },
  'Voador': {
    imagem: 'Butterfly', grupo: 'Peito', musculos: 'Peito, ombro (frente)',
    passos: ['Ajuste o banco para as pegadas ficarem na altura do peito.', 'Costas coladas no encosto, cotovelos levemente flexionados.', 'Junte os braços à frente, apertando o peito um instante.', 'Volte devagar até abrir o peito, sem jogar os ombros para trás.'],
    dica: 'Carga que permita parar a volta sem "cair" no peso.', erro: 'Abrir demais e forçar a frente do ombro.',
  },
  'Fortalecimento manguito halter': {
    imagem: 'External_Rotation', grupo: 'Ombro', musculos: 'Manguito rotador (infraespinhal, redondo menor)',
    passos: ['Deite de lado, cotovelo colado ao corpo e dobrado a 90°, halter leve na mão de cima.', 'Gire o antebraço para cima, afastando a mão do abdômen.', 'Desça devagar até a posição inicial.'],
    dica: 'Carga bem leve e repetições controladas; o cotovelo não sai do lugar.', erro: 'Usar peso demais e compensar com o tronco.',
  },
  'Fortalecimento manguito polia': {
    imagem: 'External_Rotation_with_Cable', grupo: 'Ombro', musculos: 'Manguito rotador',
    passos: ['Polia na altura do cotovelo; fique de lado para o aparelho, cotovelo colado ao corpo a 90°.', 'Gire o antebraço para fora (ou para dentro, conforme o treino).', 'Volte devagar sem soltar a carga.'],
    dica: 'Pode apoiar uma toalha dobrada entre o cotovelo e o corpo para manter a posição.', erro: 'Afastar o cotovelo do corpo.',
  },
  'Tríceps máquina': {
    imagem: 'Machine_Triceps_Extension', grupo: 'Tríceps', musculos: 'Tríceps',
    passos: ['Ajuste o assento para os cotovelos ficarem alinhados ao eixo da máquina.', 'Cotovelos junto ao corpo, ombros baixos.', 'Estenda os braços até quase travar.', 'Volte devagar até os cotovelos dobrarem a cerca de 90°.'],
    dica: 'Só os antebraços se movem.', erro: 'Levantar os ombros ou afastar os cotovelos.',
  },
  'Tríceps corda': {
    imagem: 'Triceps_Pushdown_-_Rope_Attachment', grupo: 'Tríceps', musculos: 'Tríceps',
    passos: ['Polia alta com corda; cotovelos colados nas costelas.', 'Estenda os braços para baixo e abra a corda no final.', 'Volte devagar até o antebraço ficar a 90° com o braço.'],
    dica: 'Aperte o tríceps na parte de baixo por um instante.', erro: 'Inclinar o tronco e usar o corpo para empurrar.',
  },
  'Tríceps barra reta polia': {
    imagem: 'Triceps_Pushdown', grupo: 'Tríceps', musculos: 'Tríceps',
    passos: ['Polia alta com barra reta, pegada pronada na largura dos ombros.', 'Cotovelos colados ao corpo.', 'Empurre a barra para baixo até estender os braços.', 'Suba devagar até a barra chegar perto do peito.'],
    dica: 'Mantenha os punhos retos.', erro: 'Deixar os cotovelos "andarem" para a frente.',
  },
  'Tríceps coice': {
    imagem: 'Tricep_Dumbbell_Kickback', grupo: 'Tríceps', musculos: 'Tríceps',
    passos: ['Tronco inclinado, uma mão apoiada no banco, cotovelo da outra dobrado e colado ao corpo.', 'Estenda o antebraço para trás até o braço ficar reto.', 'Volte devagar sem mexer o braço (parte de cima).'],
    dica: 'Carga leve; o que conta é o controle.', erro: 'Balançar o braço para ajudar a subir.',
  },
  'Tríceps francês': {
    imagem: 'Standing_Dumbbell_Triceps_Extension', grupo: 'Tríceps', musculos: 'Tríceps (cabeça longa)',
    passos: ['Em pé ou sentado, segure o halter (ou barra) acima da cabeça com os braços esticados.', 'Dobre os cotovelos levando o peso para trás da cabeça.', 'Estenda de volta, mantendo os cotovelos apontados para cima.'],
    dica: 'Cotovelos fechados, apontando para o teto.', erro: 'Abrir os cotovelos e arquear a lombar.',
  },
  'Cadeira extensora': {
    imagem: 'Leg_Extensions', grupo: 'Pernas', musculos: 'Quadríceps',
    passos: ['Ajuste o encosto para o joelho ficar alinhado ao eixo; o rolo fica sobre o peito do pé.', 'Estenda os joelhos até quase esticar.', 'Segure 1 s em cima e desça devagar.'],
    dica: 'Mantenha o quadril colado no assento.', erro: 'Chutar a carga e travar o joelho com força.',
  },
  'Agachamento livre': {
    imagem: 'Barbell_Squat', grupo: 'Pernas', musculos: 'Quadríceps, glúteos, posteriores, core',
    passos: ['Pés na largura dos ombros, pontas levemente para fora, barra apoiada nas costas (trapézio).', 'Respire fundo, contraia o abdômen e desça empurrando o quadril para trás e os joelhos para fora.', 'Desça até as coxas ficarem paralelas ao chão (ou o máximo que a coluna neutra permitir).', 'Suba empurrando o chão, sem perder a postura.'],
    dica: 'Joelhos acompanham a direção dos pés; olhar para frente.', erro: 'Joelhos para dentro e coluna arredondada. Com carga alta, peça para alguém acompanhar.',
  },
  'Mesa flexora': {
    imagem: 'Lying_Leg_Curls', grupo: 'Pernas', musculos: 'Posteriores de coxa',
    passos: ['Deite de bruços; o rolo fica logo acima do calcanhar.', 'Dobre os joelhos trazendo o rolo em direção ao glúteo.', 'Volte devagar até quase estender.'],
    dica: 'Quadril colado no banco.', erro: 'Levantar o quadril para ajudar.',
  },
  'Leg press 45°': {
    imagem: 'Leg_Press', grupo: 'Pernas', musculos: 'Quadríceps, glúteos, posteriores',
    passos: ['Costas e quadril bem apoiados; pés na largura dos ombros no meio da plataforma.', 'Destrave e desça até os joelhos chegarem perto de 90°.', 'Empurre a plataforma sem travar os joelhos no topo.'],
    dica: 'Pés mais altos trabalham mais glúteo e posterior; mais baixos, mais quadríceps.', erro: 'Descer demais e o quadril sair do banco (a lombar curva).',
  },
  'Leg press ou hack': {
    imagem: 'Hack_Squat', grupo: 'Pernas', musculos: 'Quadríceps, glúteos',
    passos: ['Costas e quadril apoiados; pés na largura dos ombros.', 'Desça controlando até os joelhos ficarem em torno de 90°.', 'Empurre sem travar os joelhos no topo.'],
    dica: 'Joelhos seguem a direção dos pés.', erro: 'Quadril sair do apoio na descida.',
  },
  'Cadeira adutora': {
    imagem: 'Thigh_Adductor', grupo: 'Pernas', musculos: 'Adutores (parte interna da coxa)',
    passos: ['Sente com as costas apoiadas e as pernas abertas nos apoios.', 'Feche as pernas controlando até juntar.', 'Abra devagar de volta.'],
    dica: 'Sem balançar o tronco.', erro: 'Deixar a carga "bater" na volta.',
  },
  'Cadeira abdutora': {
    imagem: 'Thigh_Abductor', grupo: 'Pernas', musculos: 'Glúteo médio e mínimo',
    passos: ['Sente com as costas apoiadas, pernas juntas nos apoios.', 'Abra as pernas até onde o movimento for controlado.', 'Volte devagar até quase juntar.'],
    dica: 'Inclinar o tronco levemente para frente enfatiza mais o glúteo.', erro: 'Jogar o corpo para abrir.',
  },
  'Panturrilha em pé': {
    imagem: 'Standing_Calf_Raises', grupo: 'Pernas', musculos: 'Panturrilha (gastrocnêmio)',
    passos: ['Ombros sob os apoios, bola dos pés na borda da plataforma.', 'Suba o máximo possível nas pontas dos pés.', 'Desça devagar até alongar bem a panturrilha.'],
    dica: 'Pause 1 s no alto e no fundo.', erro: 'Fazer movimento curto e rápido.',
  },
  'Puxada alta': {
    imagem: 'Wide-Grip_Lat_Pulldown', grupo: 'Costas', musculos: 'Dorsais, bíceps, parte de trás do ombro',
    passos: ['Ajuste o apoio das coxas; pegada pronada, um pouco mais larga que os ombros.', 'Peito aberto, leve inclinação para trás.', 'Puxe a barra até a altura do queixo/clavícula, levando os cotovelos para baixo.', 'Volte devagar até esticar os braços.'],
    dica: 'Pense em puxar com os cotovelos, não com as mãos.', erro: 'Balançar o tronco e puxar a barra atrás da nuca.',
  },
  'Pulldown polia ou máquina': {
    imagem: 'Straight-Arm_Pulldown', grupo: 'Costas', musculos: 'Dorsais, redondo maior',
    passos: ['Braços estendidos, leve inclinação do tronco para trás.', 'Puxe a barra ou as pegadas para baixo, com os braços quase retos, até perto da coxa.', 'Volte devagar sentindo o dorsal alongar.'],
    dica: 'Ombros longe das orelhas, peito aberto.', erro: 'Dobrar os cotovelos demais, virando remada.',
  },
  'Puxador supinado máquina': {
    imagem: 'Underhand_Cable_Pulldowns', grupo: 'Costas', musculos: 'Dorsais (parte baixa), bíceps',
    passos: ['Pegada supinada (palmas para você), na largura dos ombros.', 'Puxe até o queixo, cotovelos junto ao corpo.', 'Volte controlando até esticar.'],
    dica: 'Mantenha o peito para cima.', erro: 'Usar muito impulso do tronco.',
  },
  'Remada máquina (serrote)': {
    imagem: 'Leverage_Iso_Row', grupo: 'Costas', musculos: 'Dorsais, romboides, bíceps',
    passos: ['Peito apoiado no encosto (se houver) e pés firmes.', 'Puxe as pegadas em direção ao tronco, levando os cotovelos para trás.', 'Junte as escápulas no final e volte devagar.'],
    dica: 'Não encolha os ombros.', erro: 'Girar o tronco para puxar.',
  },
  'Remada baixa': {
    imagem: 'Seated_Cable_Rows', grupo: 'Costas', musculos: 'Dorsais, romboides, trapézio, bíceps',
    passos: ['Sente com os joelhos levemente flexionados e a coluna ereta.', 'Puxe o triângulo até o abdômen, cotovelos junto ao corpo.', 'Junte as escápulas e volte devagar, sem arredondar as costas.'],
    dica: 'Tronco quase parado; quem se move são os braços e as escápulas.', erro: 'Inclinar o tronco para frente e para trás.',
  },
  'Voador invertido': {
    imagem: 'Reverse_Machine_Flyes', grupo: 'Ombro', musculos: 'Parte de trás do ombro, romboides',
    passos: ['Peito apoiado no encosto, braços na frente.', 'Abra os braços para trás em arco, cotovelos levemente flexionados.', 'Volte devagar sem soltar a carga.'],
    dica: 'Carga moderada: o músculo é pequeno.', erro: 'Puxar com as costas em vez de abrir o ombro.',
  },
  'Desenvolvimento máquina': {
    imagem: 'Machine_Shoulder_Military_Press', grupo: 'Ombro', musculos: 'Ombro (frente e lateral), tríceps',
    passos: ['Ajuste o assento: as pegadas ficam na altura dos ombros.', 'Costas apoiadas.', 'Empurre para cima até quase estender os cotovelos.', 'Desça devagar até a altura das orelhas.'],
    dica: 'Não arqueie a lombar.', erro: 'Descer pouco ou travar os cotovelos.',
  },
  'Elevação lateral': {
    imagem: 'Side_Lateral_Raise', grupo: 'Ombro', musculos: 'Ombro (lateral)',
    passos: ['Em pé, halteres ao lado do corpo, cotovelos levemente dobrados.', 'Levante os braços para os lados até a altura dos ombros.', 'Desça devagar (2–3 s).'],
    dica: 'Carga leve; leve o cotovelo, não a mão.', erro: 'Balançar o tronco e levantar acima dos ombros.',
  },
  'Elevação frontal': {
    imagem: 'Front_Dumbbell_Raise', grupo: 'Ombro', musculos: 'Ombro (frente)',
    passos: ['Em pé, halteres na frente das coxas.', 'Levante um braço (ou os dois) à frente até a altura dos ombros.', 'Desça devagar.'],
    dica: 'Sem impulso do corpo.', erro: 'Subir o peso acima da altura dos ombros.',
  },
  'Encolhimento ombro': {
    imagem: 'Dumbbell_Shrug', grupo: 'Ombro', musculos: 'Trapézio (parte de cima)',
    passos: ['Em pé, halteres ao lado do corpo, braços esticados.', 'Suba os ombros em direção às orelhas.', 'Pause 1 s e desça devagar.'],
    dica: 'Movimento só vertical.', erro: 'Girar os ombros em círculo.',
  },
  'Rosca direta barra W': {
    imagem: 'Barbell_Curl', grupo: 'Bíceps', musculos: 'Bíceps',
    passos: ['Em pé, pegada supinada na largura dos ombros, cotovelos colados ao corpo.', 'Dobre os cotovelos até a barra chegar perto do peito.', 'Desça devagar até estender quase por completo.'],
    dica: 'Pés firmes, abdômen contraído.', erro: 'Jogar o corpo para trás e usar impulso.',
  },
  'Rosca barra W': {
    imagem: 'EZ-Bar_Curl', grupo: 'Bíceps', musculos: 'Bíceps',
    passos: ['Em pé, pegada supinada na largura dos ombros, cotovelos junto ao corpo.', 'Suba a barra sem mexer os cotovelos.', 'Desça devagar.'],
    dica: 'Controle a descida: é onde o bíceps mais trabalha.', erro: 'Balançar o tronco.',
  },
  'Rosca martelo': {
    imagem: 'Hammer_Curls', grupo: 'Bíceps', musculos: 'Bíceps, braquiorradial (antebraço)',
    passos: ['Em pé, halteres com as palmas voltadas uma para a outra.', 'Suba os halteres sem girar os punhos.', 'Desça devagar.'],
    dica: 'Cotovelos parados ao lado do corpo.', erro: 'Mexer os ombros para ajudar.',
  },
  'Rosca concentrada halter': {
    imagem: 'Concentration_Curls', grupo: 'Bíceps', musculos: 'Bíceps',
    passos: ['Sentado, cotovelo apoiado na parte interna da coxa.', 'Dobre o cotovelo subindo o halter até o ombro.', 'Desça devagar, até estender quase por completo.'],
    dica: 'Só o antebraço se move.', erro: 'Girar o tronco para subir o peso.',
  },
  'Abdominal remador': {
    imagem: 'Jackknife_Sit-Up', grupo: 'Abdômen', musculos: 'Abdômen, flexores do quadril',
    passos: ['Deite com braços esticados acima da cabeça e pernas estendidas.', 'Traga ao mesmo tempo os joelhos ao peito e os braços para as canelas.', 'Volte estendendo tudo, sem encostar os pés no chão.'],
    dica: 'Lombar colada no chão durante o movimento.', erro: 'Arquear a lombar na volta.',
  },
  'Infra no chão': {
    imagem: 'Flat_Bench_Lying_Leg_Raise', grupo: 'Abdômen', musculos: 'Abdômen (parte de baixo)',
    passos: ['Deitado, mãos sob o quadril, pernas estendidas.', 'Suba as pernas até a vertical, sem balançar.', 'Desça devagar, parando antes de encostar no chão.'],
    dica: 'Se a lombar descolar, dobre um pouco os joelhos.', erro: 'Usar impulso e deixar a lombar arquear.',
  },
  'Prancha': {
    imagem: 'Plank', grupo: 'Abdômen', musculos: 'Core (abdômen, lombar, ombros)',
    passos: ['Apoie antebraços e pontas dos pés, cotovelos sob os ombros.', 'Corpo em linha reta da cabeça aos calcanhares.', 'Contraia abdômen e glúteos e respire normalmente.'],
    dica: 'Olhar para o chão, pescoço neutro.', erro: 'Deixar o quadril cair ou subir.',
  },
};
