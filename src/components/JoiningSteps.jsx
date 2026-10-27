// The three-step joining explainer shared by the Build in Public pages.
export default function JoiningSteps() {
  return (
    <section className="ink-steps" aria-labelledby="ink-steps-title">
      <h2 id="ink-steps-title">How joining works</h2>
      <ol>
        <li>
          <span>1</span>
          <h3>Pick a project</h3>
          <p>Read its brief, its track and what it needs right now.</p>
        </li>
        <li>
          <span>2</span>
          <h3>Send a request</h3>
          <p>Who you are, why you want in, and the first thing you would build.</p>
        </li>
        <li>
          <span>3</span>
          <h3>Build with the team</h3>
          <p>Accepted contributors get a reply by email and start shipping.</p>
        </li>
      </ol>
    </section>
  )
}
