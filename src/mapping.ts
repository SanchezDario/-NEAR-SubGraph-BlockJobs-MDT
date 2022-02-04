import { near, JSONValue, json, log, BigInt, TypedMap } from "@graphprotocol/graph-ts"
import { Dispute } from "../generated/schema"

export function handleReceipt(receipt: near.ReceiptWithOutcome): void {
  const actions = receipt.receipt.actions;
  for (let i = 0; i < actions.length; i++) {
    handleAction(
      actions[i], 
      receipt.receipt, 
      receipt.outcome,
      receipt.block.header
    );
  }
}

function parseEvent(logData: string): TypedMap<string, JSONValue> {
  let outcomeLog = logData.toString();
  // log.info('outcomeLog {}', [outcomeLog]);

  let jsonData = json.try_fromString(outcomeLog);
  const jsonObject = jsonData.value.toObject();

  return jsonObject;
}

function handleAction(
  action: near.ActionValue,
  receipt: near.ActionReceipt,
  outcome: near.ExecutionOutcome,
  blockHeader: near.BlockHeader
): void {
  if (action.kind != near.ActionKind.FUNCTION_CALL) return;

  const methodName = action.toFunctionCall().methodName;

  for (let i = 0; i < outcome.logs.length; i++) {
    const logParsed = parseEvent(outcome.logs[i]);

    if (methodName == 'new_dispute') {
      const logJson = logParsed.get('dispute_new');
      if (!logJson) return;
      const data = logJson.toObject();

      const id = data.get('id');
      const service = data.get('dispute_id');
      const applicant = data.get('applicant');
      const accused = data.get('accused');
      const jury = data.get('jury_members');
      const status = data.get('dispute_status');
      const initial_timestamp = data.get('initial_timestamp');
      const finish_timestamp = data.get('finish_timestamp');
      const applicant_proves = data.get('applicant_proves');
      const accused_proves = data.get('accused_proves');
      const price = data.get('price');

      if (id == null || service == null || applicant == null || applicant == null || accused == null ||
        jury == null || status == null || initial_timestamp == null  || finish_timestamp == null
        || applicant_proves == null || accused_proves == null || price == null ) { 
        log.error("[data] don't exist", []); return; 
      }
      
      let dispute = new Dispute(id.toString());
      dispute.id = id.toString();
      dispute.serviceId = service.toString();
      dispute.applicant = applicant.toString();
      dispute.accused = accused.toString();
      dispute.state = status.toString();
      dispute.initialTime = initial_timestamp.toBigInt();
      dispute.finalTime = finish_timestamp.toBigInt();
      dispute.applicantProves = accused_proves.toString();
      dispute.accusedProves = accused_proves.toString();
      dispute.price = price.toBigInt();
      dispute.votes = [];
      dispute.jury = [];
      dispute.winner = '';

      dispute.save();
    }

    else if (methodName == 'pre_vote') {
      const logJson = logParsed.get('dispute_application');
      if (!logJson) return;
      const data = logJson.toObject();

      const id = data.get('id');
      if (id == null) return;

      let dispute = Dispute.load(id.toString());
      if (!dispute) return;

      const account = data.get('account_id');
      if (account == null) return;

      dispute.jury?.push(account.toString())

      dispute.save();
    }

    else if (methodName == 'vote') {
      const logJson = logParsed.get('dispute_vote');
      if (!logJson) return;
      const data = logJson.toObject();

      const id = data.get('id');
      if (id == null) return;

      let dispute = Dispute.load(id.toString());
      if (!dispute) return;

      const vote = data.get('vote')?.toBool();
      if (vote == null) return;

      dispute.votes?.push(vote)

      dispute.save();
    }

    else if (methodName == 'update_dispute_status') {
      const logJson = logParsed.get('dispute_change_status');
      if (!logJson) return;
      const data = logJson.toObject();

      const id = data.get('id');
      if (id == null) return;

      let dispute = Dispute.load(id.toString());
      if (!dispute) return;

      const new_status = data.get('status');
      if (new_status == null) return;

      dispute.state = new_status.toString();
      dispute.save();
    }
  }
}