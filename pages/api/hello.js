// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import { withDatadome } from "../../lib/datadome";

function handler(req, res) {
  res.status(200).json({ name: 'John Doe' })
}

export default withDatadome(handler);
