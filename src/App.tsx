import { useState } from "react";

export default function App() {

  const [lpm, setLpm] = useState<number[]>([]);
  const [velocidade, setVelocidade] = useState<number>(0);
  const [espacamento, setEspacamento] = useState<number>(0);
  const [alvo, setAlvo] = useState<number>(0);

  const calcular = () => {

    if (lpm.length === 0) return 0;

    const media =
      lpm.reduce((a, b) => a + b, 0) / lpm.length;

    const litrosHa =
      (media * 600) / (velocidade * espacamento);

    return litrosHa.toFixed(2);
  };

  const adicionarBico = () => {
    setLpm([...lpm, 0]);
  };

  const alterarBico = (index: number, valor: number) => {

    const novo = [...lpm];
    novo[index] = valor;

    setLpm(novo);
  };

  return (

    <div
      style={{
        padding: 40,
        fontFamily: "Arial",
        maxWidth: 600,
        margin: "auto",
      }}
    >

      <h1>Validação de Vazão</h1>

      <br />

      <div>
        <label>Velocidade km/h</label>
        <input
          type="number"
          onChange={(e) =>
            setVelocidade(Number(e.target.value))
          }
        />
      </div>

      <br />

      <div>
        <label>Espaçamento bicos (m)</label>
        <input
          type="number"
          onChange={(e) =>
            setEspacamento(Number(e.target.value))
          }
        />
      </div>

      <br />

      <div>
        <label>Vazão alvo L/ha</label>
        <input
          type="number"
          onChange={(e) =>
            setAlvo(Number(e.target.value))
          }
        />
      </div>

      <br />

      <button onClick={adicionarBico}>
        Adicionar Bico
      </button>

      <br />
      <br />

      {lpm.map((valor, index) => (

        <div key={index}>

          <label>Bico {index + 1}</label>

          <input
            type="number"
            value={valor}
            onChange={(e) =>
              alterarBico(index, Number(e.target.value))
            }
          />

        </div>

      ))}

      <br />

      <h2>

        Vazão Calculada: {calcular()} L/ha

      </h2>

      <h3>

        Alvo: {alvo} L/ha

      </h3>

    </div>

  );
}
